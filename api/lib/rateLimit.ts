/**
 * Minimal fixed-window rate limiter, keyed by a caller-supplied string
 * (e.g. a hashed IP — see messages.ts for why we hash it and don't store it).
 *
 * This is in-memory, so on serverless platforms with multiple instances it's
 * a best-effort layer, not a hard guarantee. For stricter protection at
 * scale, move this to your edge/CDN (e.g. Vercel/Cloudflare rate limiting)
 * or a shared store like Redis (Upstash) — the interface below is designed
 * to be swapped out without touching messages.ts.
 */

interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 5; // 5 submissions per minute per key

export function isRateLimited(key: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    buckets.set(key, { count: 1, windowStart: now });
    return false;
  }

  bucket.count += 1;
  return bucket.count > MAX_REQUESTS_PER_WINDOW;
}

// Periodically forget old buckets so this map doesn't grow forever.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart > WINDOW_MS * 5) buckets.delete(key);
  }
}, WINDOW_MS * 5).unref?.();
