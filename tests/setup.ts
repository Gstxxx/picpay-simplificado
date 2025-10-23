
process.env.DATABASE_URL = 'file:./test.db';
process.env.JWT_SECRET = 'test-secret-key-must-be-at-least-32-characters-long';
process.env.NODE_ENV = 'test';
process.env.PORT = '3006';
process.env.AUTH_URL = 'https://util.devi.tools/api/v2/authorize';
process.env.NOTIFY_URL = 'https://util.devi.tools/api/v1/notify';
process.env.CORS_ORIGINS = '*';

import { beforeAll, afterAll, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

beforeAll(async () => {

  if (fs.existsSync('test.db')) {
    fs.unlinkSync('test.db');
  }


  execSync('npx prisma db push --force-reset --skip-generate', {
    env: { ...process.env, DATABASE_URL: 'file:./test.db' },
    stdio: 'ignore',
  });
});

afterEach(async () => {

  try {
    await prisma.transaction.deleteMany();
    await prisma.notificationOutbox.deleteMany();
    await prisma.user.deleteMany();
  } catch (error) {

  }
});

afterAll(async () => {
  await prisma.$disconnect();

  if (fs.existsSync('test.db')) {
    fs.unlinkSync('test.db');
  }
});

export { prisma };

