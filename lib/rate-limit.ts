import { HttpError } from "./http";

type Bucket = { count: number; resetAt: number };

const globalForLimit = globalThis as unknown as { rdRateLimit?: Map<string, Bucket> };
const buckets = (globalForLimit.rdRateLimit ??= new Map<string, Bucket>());

function sweep(now: number) {
  if (buckets.size < 500) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Fixed-window in-memory limiter. Good enough for a single-process hackathon
 * deployment; swap for Redis/Upstash when running multiple instances.
 */
export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  sweep(now);
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterMs: 0 };
  }
  existing.count += 1;
  if (existing.count > limit) {
    return { allowed: false, remaining: 0, retryAfterMs: existing.resetAt - now };
  }
  return { allowed: true, remaining: limit - existing.count, retryAfterMs: 0 };
}

export function enforceRateLimit(key: string, limit: number, windowMs: number) {
  const result = rateLimit(key, limit, windowMs);
  if (!result.allowed) {
    throw new HttpError(
      429,
      "Too many requests. Please slow down and try again shortly.",
      "rate_limited",
      { retryAfterSeconds: Math.ceil(result.retryAfterMs / 1000) },
    );
  }
}
