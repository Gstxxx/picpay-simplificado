import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { config } from './config.js';
import { authApp } from './routes/auth/index.js';
import { transactionsApp } from './routes/transactions/index.js';
import { healthApp } from './routes/health/index.js';
import { securityHeaders } from './middleware/security.js';
import { errorHandler } from './middleware/errors.js';
import { rateLimiter } from './middleware/rateLimit.js';
import { startNotificationWorker } from './workers/notificationWorker.js';

const mainApp = new Hono();

const allowedOrigins = config.CORS_ORIGINS.split(',').map((o: string) => o.trim());
mainApp.use(
  '/*',
  cors({
    origin: allowedOrigins.includes('*') ? '*' : allowedOrigins,
  })
);
mainApp.use('/*', securityHeaders);
mainApp.use('/*', logger());

const apiApp = new Hono()
  .basePath('/api/v1')
  .route('/', healthApp)
  .route('/auth', authApp.use('/login', rateLimiter({ windowMs: 60000, maxRequests: 5 })))
  .route('/', transactionsApp);

mainApp.route('/', apiApp);

mainApp.onError(errorHandler);

const routes = apiApp;
export type AppType = typeof routes;

startNotificationWorker();

const port = config.PORT;
console.log(`✅ Server running on port ${port}`);
console.log(`✅ Environment: ${config.NODE_ENV}`);

serve({
  fetch: mainApp.fetch,
  port,
});
