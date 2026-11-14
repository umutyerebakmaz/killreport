-- Shared ESI limiter: ask for one dispatch slot.
--
-- Loaded as-is by the Node store (shared-store.ts) and by the Rust store
-- (include_str!), so this file is the single copy of the logic. The rules
-- mirror backend/src/services/rate-limiter.ts.
--
-- ARGV: [1] key prefix, [2] priority ('live' | 'bulk'), [3] route template,
--       [4] bucketKey ('' for none), [5] maxRps, [6] floor,
--       [7] now in ms ('' to use Redis TIME).
-- Returns {1} when granted, or {0, waitMs, reason, detail}:
--   reason 'brake' -> detail '<status>:<kind>', e.g. '420:error-limit'
--   reason 'group' -> detail '<group>:<bucketKey>'
--   reason 'rate'  -> detail ''

local RATE_CLIMB_INTERVAL_MS = 10000
local LOW_TOKEN_SHARE = 0.2
local SUCCESS_TOKEN_COST = 2
local NEVER = -1e15

local prefix = ARGV[1]
local priority = ARGV[2]
local template = ARGV[3]
local bucketKey = ARGV[4]
local maxRps = tonumber(ARGV[5])
local floorTokens = tonumber(ARGV[6])

local now
if ARGV[7] == '' then
  local t = redis.call('TIME')
  now = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)
else
  now = tonumber(ARGV[7])
end

-- Exact round trip for numbers stored in a hash.
local function str(n)
  return string.format('%.17g', n)
end

local function num(value, default)
  if value == false or value == nil then return default end
  return tonumber(value)
end

local globalKey = prefix .. 'global'
local g = redis.call('HMGET', globalKey, 'tokens', 'refilledAt',
  'pausedUntil', 'pauseStatus', 'pauseKind', 'rateBase', 'loweredAt')
local pausedUntil = num(g[3], 0)
local rateBase = num(g[6], maxRps)
local loweredAt = num(g[7], NEVER)

-- 1. The process-wide brake.
if pausedUntil > now then
  return {0, math.ceil(pausedUntil - now), 'brake',
    (g[4] or '0') .. ':' .. (g[5] or '')}
end

-- 2. The route's group bucket, once its group has been learnt.
local bucket = nil
local bucketRedisKey = nil
local group = redis.call('HGET', prefix .. 'groups', template)
if group then
  bucketRedisKey = prefix .. 'bucket:' .. group .. ':' .. bucketKey
  local b = redis.call('HMGET', bucketRedisKey, 'limit', 'windowMs',
    'remaining', 'updatedAt', 'sentAt', 'nextAllowedAt', 'pausedUntil')
  -- An expired bucket is no bucket, as an unknown one is in rate-limiter.ts.
  if b[4] then
    bucket = {
      limit = num(b[1], nil),
      windowMs = num(b[2], nil),
      remaining = num(b[3], nil),
      updatedAt = num(b[4], 0),
      sentAt = num(b[5], NEVER),
      nextAllowedAt = num(b[6], 0),
      pausedUntil = num(b[7], 0),
    }
    local readyAt = math.max(bucket.pausedUntil, bucket.nextAllowedAt)
    if readyAt > now then
      return {0, math.ceil(readyAt - now), 'group', group .. ':' .. bucketKey}
    end
  end
end

-- 3. Refill the shared bucket at the adapted rate.
local climbFrom = math.max(loweredAt, pausedUntil)
local climbed = math.max(0, math.floor((now - climbFrom) / RATE_CLIMB_INTERVAL_MS))
local rate = math.min(maxRps, rateBase + climbed)
local capacity = math.max(floorTokens + 1, rate)
local tokens = num(g[1], capacity)
local refilledAt = num(g[2], 0)
local elapsed = math.max(0, now - refilledAt)
tokens = math.min(capacity, tokens + rate * elapsed / 1000)
refilledAt = math.max(refilledAt, now)

-- 4. Bulk keeps `floorTokens` tokens back for live traffic.
local need = 1
if priority ~= 'live' then need = floorTokens + 1 end
if tokens < need then
  redis.call('HSET', globalKey, 'tokens', str(tokens), 'refilledAt', str(refilledAt))
  return {0, math.ceil((need - tokens) / rate * 1000), 'rate', ''}
end

-- 5. Take the token; a grouped route marks its bucket as just sent.
tokens = tokens - 1
redis.call('HSET', globalKey, 'tokens', str(tokens), 'refilledAt', str(refilledAt))

if bucket then
  bucket.sentAt = now
  -- respace, as in rate-limiter.ts
  local nextAllowedAt = 0
  local limit = bucket.limit
  local remaining = bucket.remaining
  if limit and limit > 0 and remaining and remaining < limit * LOW_TOKEN_SHARE then
    local pace = (bucket.windowMs / limit) * SUCCESS_TOKEN_COST
    local from = bucket.sentAt
    if remaining < SUCCESS_TOKEN_COST then
      from = math.max(bucket.sentAt, bucket.updatedAt)
    end
    nextAllowedAt = from + pace
  end
  redis.call('HSET', bucketRedisKey, 'sentAt', str(bucket.sentAt),
    'nextAllowedAt', str(nextAllowedAt))
end

return {1}
