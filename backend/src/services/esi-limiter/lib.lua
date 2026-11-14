-- Shared ESI limiter: helpers used by both acquire.lua and observe.lua.
--
-- Loading rule: this file is never run on its own. Every store sends
-- lib.lua + "\n" + <script>.lua to Redis as ONE script body, and the SHA for
-- EVALSHA is the SHA-1 of that combined body. Node concatenates the files at
-- load (shared-store.ts); Rust does
-- concat!(include_str!("lib.lua"), "\n", include_str!("<script>.lua")).
-- Everything here is a top-level local, so it is in scope for the script
-- appended after it.
--
-- The rules mirror backend/src/services/rate-limiter.ts, except for two that
-- exist only here: the shared bucket holds floor + 1 tokens (no burst), and
-- the rate climbs only while tokens are being granted (acquire.lua).

local RATE_CLIMB_INTERVAL_MS = 10000
local LOW_TOKEN_SHARE = 0.2
local SUCCESS_TOKEN_COST = 2
local NEVER = -1e15

-- Exact round trip for numbers stored in a hash.
local function str(n)
  return string.format('%.17g', n)
end

-- A hash field from HMGET (false when absent) as a number, or the default.
local function num(value, default)
  if value == false or value == nil then return default end
  return tonumber(value)
end

-- The `now` ARGV in ms, or Redis TIME when it is absent or ''.
local function nowMs(arg)
  if arg == nil or arg == '' then
    local t = redis.call('TIME')
    return tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)
  end
  return tonumber(arg)
end

-- The adapted dispatch rate: +1 req/s per full 10 s since the last decrease,
-- the end of the last brake or the end of the last idle gap (climbFrom, set
-- by acquire.lua), whichever is latest. Neither braked nor idle time counts
-- towards the climb.
local function currentRate(maxRps, rateBase, loweredAt, pausedUntil, climbFrom, now)
  local from = math.max(loweredAt, pausedUntil, climbFrom)
  local climbed = math.max(0, math.floor((now - from) / RATE_CLIMB_INTERVAL_MS))
  return math.min(maxRps, rateBase + climbed)
end

-- A group bucket's hash, or nil when it does not exist (never observed, or
-- expired). observe always writes updatedAt, so that field marks existence.
local function readBucket(redisKey)
  local b = redis.call('HMGET', redisKey, 'limit', 'windowMs', 'remaining',
    'updatedAt', 'sentAt', 'nextAllowedAt', 'pausedUntil')
  if not b[4] then return nil end
  return {
    limit = num(b[1], nil),
    windowMs = num(b[2], nil),
    remaining = num(b[3], nil),
    updatedAt = num(b[4], 0),
    sentAt = num(b[5], NEVER),
    nextAllowedAt = num(b[6], 0),
    pausedUntil = num(b[7], 0),
  }
end

-- Below 20% remaining, send no faster than the bucket refills (one request per
-- window / limit x 2); below one 2xx's worth, count that gap from the last
-- response too. Unknown limit or remaining means no spacing.
local function respace(bucket)
  local limit, remaining = bucket.limit, bucket.remaining
  if not (limit and limit > 0 and remaining and remaining < limit * LOW_TOKEN_SHARE) then
    bucket.nextAllowedAt = 0
    return
  end
  local pace = (bucket.windowMs / limit) * SUCCESS_TOKEN_COST
  local from = bucket.sentAt
  if remaining < SUCCESS_TOKEN_COST then
    from = math.max(bucket.sentAt, bucket.updatedAt)
  end
  bucket.nextAllowedAt = from + pace
end
