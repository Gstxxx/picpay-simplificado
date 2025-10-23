import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).pipe(z.number().int().positive()).default('3005'),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  AUTH_URL: z.string().url().default('https://util.devi.tools/api/v2/authorize'),
  NOTIFY_URL: z.string().url().default('https://util.devi.tools/api/v1/notify'),
  CORS_ORIGINS: z.string().default('*'),
});

function loadConfig() {
  const result = configSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Invalid environment variables:', result.error.format());
    throw new Error('Invalid environment configuration');
  }
  return result.data;
}

export const config = loadConfig();

