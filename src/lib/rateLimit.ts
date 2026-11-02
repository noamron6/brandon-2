/**
 * In-memory IP rate limiter per PRD Section 10
 * Allows 5 requests per hour per IP address.
 */

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const ipMap = new Map<string, RateLimitRecord>();

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS = 5; // 5 requests per hour

export function checkRateLimit(ip: string): {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
} {
  const now = Date.now();
  const record = ipMap.get(ip);

  // Clean expired or create new
  if (!record || now > record.resetAt) {
    ipMap.set(ip, {
      count: 1,
      resetAt: now + WINDOW_MS,
    });
    return {
      allowed: true,
      remaining: MAX_REQUESTS - 1,
      resetInSeconds: Math.ceil(WINDOW_MS / 1000),
    };
  }

  if (record.count >= MAX_REQUESTS) {
    return {
      allowed: false,
      remaining: 0,
      resetInSeconds: Math.ceil((record.resetAt - now) / 1000),
    };
  }

  record.count += 1;
  return {
    allowed: true,
    remaining: MAX_REQUESTS - record.count,
    resetInSeconds: Math.ceil((record.resetAt - now) / 1000),
  };
}
