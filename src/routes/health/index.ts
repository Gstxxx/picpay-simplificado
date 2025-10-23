import { Hono } from 'hono';
import prisma from '../../lib/prisma.js';

const healthApp = new Hono();

healthApp.get('/healthz', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() }, 200);
});

healthApp.get('/readyz', async (c) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return c.json({ status: 'ready', timestamp: new Date().toISOString() }, 200);
  } catch (err) {
    return c.json({ status: 'not ready', error: 'Database unavailable' }, 503);
  }
});

export { healthApp };
