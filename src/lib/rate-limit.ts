import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { isTestingFreeMedia } from "@/lib/testing";

type Bucket =
  | "auth"
  | "chat"
  | "image"
  | "call"
  | "call_speak"
  | "call_turn"
  | "call_heartbeat"
  | "payment"
  | "contact";

const memoryBuckets = new Map<string, { count: number; reset: number }>();

function memoryLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const entry = memoryBuckets.get(key);
  if (!entry || entry.reset < now) {
    memoryBuckets.set(key, { count: 1, reset: now + windowMs });
    return { success: true, remaining: limit - 1 };
  }
  if (entry.count >= limit) {
    return { success: false, remaining: 0 };
  }
  entry.count += 1;
  return { success: true, remaining: limit - entry.count };
}

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

/** Per-user limits — sized for real concurrent use, not tiny demo caps. */
const configs: Record<Bucket, { limit: number; windowMs: number }> = {
  auth: { limit: 20, windowMs: 60_000 },
  chat: { limit: 60, windowMs: 60_000 },
  image: { limit: 20, windowMs: 60_000 },
  // start/end only
  call: { limit: 30, windowMs: 60_000 },
  call_speak: { limit: 40, windowMs: 60_000 },
  call_turn: { limit: 40, windowMs: 60_000 },
  // heartbeat ~ every 15s → need headroom for many ticks
  call_heartbeat: { limit: 120, windowMs: 60_000 },
  payment: { limit: 20, windowMs: 60_000 },
  contact: { limit: 10, windowMs: 60_000 },
};

const ratelimiters = new Map<Bucket, Ratelimit>();

function getLimiter(bucket: Bucket) {
  const redis = getRedis();
  if (!redis) return null;
  let limiter = ratelimiters.get(bucket);
  if (!limiter) {
    const cfg = configs[bucket];
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(cfg.limit, `${cfg.windowMs} ms`),
      prefix: `tw:${bucket}`,
    });
    ratelimiters.set(bucket, limiter);
  }
  return limiter;
}

export async function rateLimit(bucket: Bucket, identifier: string) {
  // Local / free-testing: don't block product QA with spam of call ticks
  if (
    isTestingFreeMedia() &&
    (bucket === "call" ||
      bucket === "call_speak" ||
      bucket === "call_turn" ||
      bucket === "call_heartbeat")
  ) {
    return { success: true, remaining: 999 };
  }

  const cfg = configs[bucket];
  const limiter = getLimiter(bucket);
  if (!limiter) {
    return memoryLimit(`${bucket}:${identifier}`, cfg.limit, cfg.windowMs);
  }
  const result = await limiter.limit(identifier);
  return { success: result.success, remaining: result.remaining };
}
