import type { Context, Next } from 'hono';

type RateLimitStore = {
  [key: string]: { count: number; resetAt: number };
};

const store: RateLimitStore = {};

export function rateLimiter(options: { windowMs: number; maxRequests: number }) {
  return async (c: Context, next: Next) => {
    const identifier = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
    const key = `${identifier}:${c.req.path}`;
    const now = Date.now();

    let record = store[key];
    if (!record || now > record.resetAt) {
      record = { count: 0, resetAt: now + options.windowMs };
      store[key] = record;
    }

    record.count++;
    if (record.count > options.maxRequests) {
      return c.json({ error: 'Too many requests' }, 429);
    }

    await next();
  };
}
