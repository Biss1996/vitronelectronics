import { HttpError } from "./http.js";

// In-memory fixed-window rate limiter. Good enough for a single instance; if you
// scale to several instances, each one keeps its own counts.
const buckets = new Map();

export function rateLimit(key, { max, windowMs }) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count++;
  if (b.count > max) {
    const retry = Math.ceil((b.resetAt - now) / 1000);
    throw new HttpError(429, `Too many attempts. Try again in ${retry} seconds.`);
  }
}

// Drop expired buckets every minute so memory stays flat.
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}, 60_000).unref();
