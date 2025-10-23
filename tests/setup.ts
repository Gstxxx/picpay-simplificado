import { beforeAll, afterAll, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import crypto from 'crypto';

// Generate unique DB name per worker to avoid locks
const workerId = process.env.VITEST_POOL_ID || '0';
const testDbName = `test-${workerId}.db`;

process.env.DATABASE_URL = `file:./${testDbName}`;
process.env.JWT_SECRET = 'test-secret-key-must-be-at-least-32-characters-long';
process.env.NODE_ENV = 'test';
process.env.PORT = '3006';
process.env.AUTH_URL = 'https://util.devi.tools/api/v2/authorize';
process.env.NOTIFY_URL = 'https://util.devi.tools/api/v1/notify';
process.env.CORS_ORIGINS = '*';

const prisma = new PrismaClient();

beforeAll(async () => {
  // Clean up existing test database
  if (fs.existsSync(testDbName)) {
    fs.unlinkSync(testDbName);
  }
  if (fs.existsSync(`${testDbName}-journal`)) {
    fs.unlinkSync(`${testDbName}-journal`);
  }

  // Initialize database schema
  try {
    execSync('npx prisma db push --force-reset --skip-generate', {
      env: { ...process.env, DATABASE_URL: `file:./${testDbName}` },
      stdio: 'pipe',
    });
  } catch (error) {
    console.error('Failed to initialize test database:', error);
    throw error;
  }
}, 30000); // Increase timeout to 30s

afterEach(async () => {
  // Clean up data between tests
  try {
    await prisma.transaction.deleteMany();
    await prisma.notificationOutbox.deleteMany();
    await prisma.user.deleteMany();
  } catch (error) {
    // Ignore cleanup errors
  }
});

afterAll(async () => {
  await prisma.$disconnect();

  // Clean up test database files
  try {
    if (fs.existsSync(testDbName)) {
      fs.unlinkSync(testDbName);
    }
    if (fs.existsSync(`${testDbName}-journal`)) {
      fs.unlinkSync(`${testDbName}-journal`);
    }
  } catch (error) {
    // Ignore cleanup errors
  }
});

export { prisma };
