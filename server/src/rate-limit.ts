export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

interface WindowEntry {
  count: number;
  resetAt: number;
}

/** Local/private-alpha limiter. Hosted multi-instance deployments must replace its storage. */
export class MemoryFixedWindowRateLimiter {
  private readonly windows = new Map<string, WindowEntry>();

  consume(
    key: string,
    policy: { limit: number; windowMs: number },
    now = Date.now(),
  ): RateLimitDecision {
    if (!key.trim()) throw new Error("Rate-limit key must not be empty.");
    if (!Number.isInteger(policy.limit) || policy.limit < 1 || policy.windowMs < 1) {
      throw new Error("Rate-limit policy must use a positive integer limit and window.");
    }
    let entry = this.windows.get(key);
    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + policy.windowMs };
      this.windows.set(key, entry);
    }
    if (entry.count >= policy.limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
      };
    }
    entry.count += 1;
    return {
      allowed: true,
      remaining: policy.limit - entry.count,
      retryAfterSeconds: 0,
    };
  }

  prune(now = Date.now()): void {
    for (const [key, entry] of this.windows) {
      if (now >= entry.resetAt) this.windows.delete(key);
    }
  }
}

export const STORYFRAME_RATE_LIMITS = {
  storyTurns: { limit: 120, windowMs: 60_000 },
  narration: { limit: 12, windowMs: 60_000 },
  feedback: { limit: 5, windowMs: 3_600_000 },
} as const;
