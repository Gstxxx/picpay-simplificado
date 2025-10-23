import type { Context, Next } from 'hono';
import { verify } from 'hono/jwt';
import { config } from '../config.js';

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid authorization header' }, 401);
  }

  const token = authHeader.substring(7);
  try {
    const payload = await verify(token, config.JWT_SECRET);
    c.set('userId', payload.sub as string);
    c.set('role', payload.role as string);
    await next();
  } catch (err) {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
}
