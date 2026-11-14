-- Shared ESI limiter: ask for one dispatch slot.
--
-- Runs with lib.lua prepended (see the loading rule there); str, num, nowMs,
-- currentRate, readBucket, respace and NEVER come from it. The rules mirror
-- backend/src/services/rate-limiter.ts.
--
-- ARGV: [1] key prefix, [2] priority ('live' | 'bulk'), [3] route template,
--       [4] bucketKey ('' for none), [5] maxRps, [6] floor,
--       [7] now in ms ('' to use Redis TIME).
-- Returns {1} when granted, or {0, waitMs, reason, detail}:
--   reason 'brake' -> detail '<status>:<kind>', e.g. '420:error-limit'
--   reason 'group' -> detail '<group>:<bucketKey>'
--   reason 'rate'  -> detail ''

local prefix = ARGV[1]
local priority = ARGV[2]
local template = ARGV[3]
local bucketKey = ARGV[4]
local maxRps = tonumber(ARGV[5])
local floorTokens = tonumber(ARGV[6])
local now = nowMs(ARGV[7])

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

-- 2. The route's group bucket, once its group has been learnt. An expired
-- bucket is no bucket, as an unknown one is in rate-limiter.ts.
local bucket = nil
local bucketRedisKey = nil
local group = redis.call('HGET', prefix .. 'groups', template)
if group then
  bucketRedisKey = prefix .. 'bucket:' .. group .. ':' .. bucketKey
  bucket = readBucket(bucketRedisKey)
  if bucket then
    local readyAt = math.max(bucket.pausedUntil, bucket.nextAllowedAt)
    if readyAt > now then
      return {0, math.ceil(readyAt - now), 'group', group .. ':' .. bucketKey}
    end
  end
end

-- 3. Refill the shared bucket at the adapted rate.
local rate = currentRate(maxRps, rateBase, loweredAt, pausedUntil, now)
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
  respace(bucket)
  redis.call('HSET', bucketRedisKey, 'sentAt', str(bucket.sentAt),
    'nextAllowedAt', str(bucket.nextAllowedAt))
end

return {1}
