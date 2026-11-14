-- Shared ESI limiter: read one response's throttling signals.
--
-- Loaded as-is by the Node store (shared-store.ts) and by the Rust store
-- (include_str!), so this file is the single copy of the logic. It mirrors
-- observe, observeGroup, pause, lowerRate, respace and currentRate in
-- backend/src/services/rate-limiter.ts, with the same constants. Header
-- parsing stays with the caller; this script only sees numbers.
--
-- ARGV: [1] key prefix, [2] route template, [3] bucketKey, [4] status,
--       [5] group, [6] limit, [7] windowMs, [8] remaining, [9] errorRemain,
--       [10] errorResetMs, [11] retryAfterMs, [12] maxRps, [13] now in ms
--       ('' to use Redis TIME). An empty string is "no value".
-- Returns {brakeMs, brakeStatus, brakeKind, groupKey, groupPauseMs, rate}.
-- brakeMs > 0 only when this call set a NEW brake (one that ends at least
-- 1000 ms past the old one), with brakeStatus (420 | 429) and brakeKind;
-- otherwise 0, 0, ''. Likewise groupPauseMs > 0 with groupKey only for a new
-- group pause; otherwise '', 0. rate is the adapted rate after the call.

local ERROR_LIMIT_FLOOR = 20
local DEFAULT_PAUSE_MS = 60000
local DEEP_LIMIT_PAUSE_MS = 15000
local RATE_DECREASE = 0.75
local MAX_PAUSE_MS = 15 * 60000
local RATE_CLIMB_INTERVAL_MS = 10000
local LOW_TOKEN_SHARE = 0.2
local SUCCESS_TOKEN_COST = 2
local BUCKET_TTL_EXTRA_MS = 60000
local NEVER = -1e15

local function opt(value)
  if value == nil or value == '' then return nil end
  return tonumber(value)
end

local function str(n)
  return string.format('%.17g', n)
end

local function num(value, default)
  if value == false or value == nil then return default end
  return tonumber(value)
end

local prefix = ARGV[1]
local template = ARGV[2]
local bucketKey = ARGV[3]
local status = tonumber(ARGV[4])
local group = ARGV[5]
local limitArg = opt(ARGV[6])
local windowArg = opt(ARGV[7])
local remainingArg = opt(ARGV[8])
local errorRemain = opt(ARGV[9])
local errorResetMs = opt(ARGV[10])
local retryAfterMs = opt(ARGV[11])
local maxRps = tonumber(ARGV[12])

local now
if ARGV[13] == nil or ARGV[13] == '' then
  local t = redis.call('TIME')
  now = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)
else
  now = tonumber(ARGV[13])
end

local globalKey = prefix .. 'global'
local g = redis.call('HMGET', globalKey, 'pausedUntil', 'pauseStatus',
  'pauseKind', 'rateBase', 'loweredAt')
local state = {
  pausedUntil = num(g[1], 0),
  rateBase = num(g[4], maxRps),
  loweredAt = num(g[5], NEVER),
}
local pauseChanged, rateChanged = false, false

local brakeMs, brakeStatus, brakeKind = 0, 0, ''
local groupKey, groupPauseMs = '', 0

local function currentRate()
  local climbFrom = math.max(state.loweredAt, state.pausedUntil)
  local climbed = math.max(0, math.floor((now - climbFrom) / RATE_CLIMB_INTERVAL_MS))
  return math.min(maxRps, state.rateBase + climbed)
end

local function result()
  if pauseChanged then
    redis.call('HSET', globalKey, 'pausedUntil', str(state.pausedUntil),
      'pauseStatus', state.pauseStatus, 'pauseKind', state.pauseKind)
  end
  if rateChanged then
    redis.call('HSET', globalKey, 'rateBase', str(state.rateBase),
      'loweredAt', str(state.loweredAt))
  end
  return {math.ceil(brakeMs), brakeStatus, brakeKind, groupKey,
    math.ceil(groupPauseMs), currentRate()}
end

local function pause(ms, pauseStatus, kind)
  if ms <= 0 then return end
  local untilMs = now + math.min(ms, MAX_PAUSE_MS)
  if untilMs <= state.pausedUntil then return end
  -- An extension under a second is the same pause seen again by a request
  -- that was already in flight; only a new or materially longer one counts.
  local isNew = untilMs - math.max(state.pausedUntil, now) >= 1000
  state.pausedUntil = untilMs
  state.pauseStatus = tostring(pauseStatus)
  state.pauseKind = kind
  pauseChanged = true
  if isNew then
    brakeMs, brakeStatus, brakeKind = untilMs - now, pauseStatus, kind
  end
end

local function lowerRate()
  state.rateBase = math.max(1, math.floor(currentRate() * RATE_DECREASE))
  state.loweredAt = now
  rateChanged = true
end

-- observeGroup
if group ~= '' then
  redis.call('HSET', prefix .. 'groups', template, group)
  local key = group .. ':' .. bucketKey
  local bucketRedisKey = prefix .. 'bucket:' .. key
  local b = redis.call('HMGET', bucketRedisKey, 'limit', 'windowMs',
    'remaining', 'updatedAt', 'sentAt', 'nextAllowedAt', 'pausedUntil')
  local bucket
  if b[4] then
    bucket = {
      limit = num(b[1], nil),
      windowMs = num(b[2], nil),
      remaining = num(b[3], nil),
      updatedAt = num(b[4], now),
      sentAt = num(b[5], NEVER),
      nextAllowedAt = num(b[6], 0),
      pausedUntil = num(b[7], 0),
    }
  else
    bucket = {
      updatedAt = now,
      sentAt = NEVER,
      nextAllowedAt = 0,
      pausedUntil = 0,
    }
  end

  if limitArg and windowArg and limitArg > 0 and windowArg > 0 then
    bucket.limit = limitArg
    bucket.windowMs = windowArg
  end
  if remainingArg then
    bucket.remaining = remainingArg
    bucket.updatedAt = now
  end

  -- respace
  bucket.nextAllowedAt = 0
  local limit, remaining = bucket.limit, bucket.remaining
  if limit and limit > 0 and remaining and remaining < limit * LOW_TOKEN_SHARE then
    local pace = (bucket.windowMs / limit) * SUCCESS_TOKEN_COST
    local from = bucket.sentAt
    if remaining < SUCCESS_TOKEN_COST then
      from = math.max(bucket.sentAt, bucket.updatedAt)
    end
    bucket.nextAllowedAt = from + pace
  end

  if status == 429 then
    local retryAfter = retryAfterMs or DEFAULT_PAUSE_MS
    if retryAfter > 0 then
      local untilMs = now + math.min(retryAfter, MAX_PAUSE_MS)
      if untilMs > bucket.pausedUntil then
        local isNew = untilMs - math.max(bucket.pausedUntil, now) >= 1000
        bucket.pausedUntil = untilMs
        if isNew then
          groupKey, groupPauseMs = key, untilMs - now
        end
      end
    end
  end

  redis.call('HSET', bucketRedisKey,
    'updatedAt', str(bucket.updatedAt),
    'sentAt', str(bucket.sentAt),
    'nextAllowedAt', str(bucket.nextAllowedAt),
    'pausedUntil', str(bucket.pausedUntil))
  if bucket.limit then
    redis.call('HSET', bucketRedisKey, 'limit', str(bucket.limit),
      'windowMs', str(bucket.windowMs))
  end
  if bucket.remaining then
    redis.call('HSET', bucketRedisKey, 'remaining', str(bucket.remaining))
  end
  redis.call('PEXPIRE', bucketRedisKey,
    math.ceil((bucket.windowMs or 0) + BUCKET_TTL_EXTRA_MS))

  -- A grouped 429 throttles only its group, never the whole process.
  if status == 429 then return result() end
end

-- The error limit.
if status == 420 then
  pause(errorResetMs or DEFAULT_PAUSE_MS, 420, 'error-limit')
elseif errorRemain and errorRemain < ERROR_LIMIT_FLOOR and errorResetMs then
  pause(errorResetMs, 420, 'error-limit')
end

-- The deep limiter: a header-less 429.
if status == 429 then
  -- 429s that land during a pause, or within 10 s of a decrease, were sent
  -- before the rate dropped: one event, one decrease.
  if now >= state.pausedUntil and now - state.loweredAt >= RATE_CLIMB_INTERVAL_MS then
    lowerRate()
  end
  pause(retryAfterMs or DEEP_LIMIT_PAUSE_MS, 429, 'deep-limit')
end

return result()
