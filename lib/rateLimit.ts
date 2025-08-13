type Stamp = number;

interface Bucket {
  stamps: Stamp[];
}

const buckets = new Map<string, Bucket>();

export function rateLimitHit(ip: string, limit: number, windowMs: number): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const floor = now - windowMs;
  const b = buckets.get(ip) || { stamps: [] };
  b.stamps = b.stamps.filter((t) => t > floor);
  if (b.stamps.length >= limit) {
    buckets.set(ip, b);
    return { allowed: false, remaining: 0 };
  }
  b.stamps.push(now);
  buckets.set(ip, b);
  return { allowed: true, remaining: Math.max(0, limit - b.stamps.length) };
} 