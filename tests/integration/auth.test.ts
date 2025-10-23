import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { authApp } from '../../src/routes/auth/index.js';
import { prisma } from '../setup.js';

describe('Authentication Integration Tests', () => {
  const app = new Hono().route('/', authApp);

  describe('POST /auth/register', () => {
    it('should register a new COMMON user', async () => {
      const userData = {
        email: 'newuser@example.com',
        password: 'SecurePass123',
        confirmPassword: 'SecurePass123',
        name: 'New User',
        documentType: 'COMMON',
        documentNumber: '12345678901',
      };

      const response = await app.request('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe('newuser@example.com');
      expect(data.user.password).toBeUndefined();
    });

    it('should register a new MERCHANT user', async () => {
      const userData = {
        email: 'merchant@example.com',
        password: 'SecurePass123',
        confirmPassword: 'SecurePass123',
        name: 'Acme Corp',
        documentType: 'MERCHANT',
        documentNumber: '12345678901234',
      };

      const response = await app.request('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.user.documentType).toBe('MERCHANT');
    });

    it('should reject duplicate email', async () => {
      const userData = {
        email: 'duplicate@example.com',
        password: 'SecurePass123',
        confirmPassword: 'SecurePass123',
        name: 'User One',
        documentType: 'COMMON',
        documentNumber: '11111111111',
      };

      await app.request('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });

      const secondAttempt = await app.request('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...userData, documentNumber: '22222222222' }),
      });

      expect(secondAttempt.status).toBe(409);
    });

    it('should reject duplicate document number', async () => {
      const userData = {
        email: 'user1@example.com',
        password: 'SecurePass123',
        confirmPassword: 'SecurePass123',
        name: 'User One',
        documentType: 'COMMON',
        documentNumber: '99999999999',
      };

      await app.request('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });

      const secondAttempt = await app.request('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...userData, email: 'user2@example.com' }),
      });

      expect(secondAttempt.status).toBe(409);
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      await app.request('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'testuser@example.com',
          password: 'TestPass123',
          confirmPassword: 'TestPass123',
          name: 'Test User',
          documentType: 'COMMON',
          documentNumber: '55555555555',
        }),
      });
    });

    it('should login with email', async () => {
      const response = await app.request('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'testuser@example.com',
          password: 'TestPass123',
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.token).toBeDefined();
      expect(data.user).toBeDefined();
      expect(data.user.password).toBeUndefined();
    });

    it('should login with document number', async () => {
      const response = await app.request('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: '55555555555',
          password: 'TestPass123',
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.token).toBeDefined();
    });

    it('should return 401 for invalid email', async () => {
      const response = await app.request('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'nonexistent@example.com',
          password: 'TestPass123',
        }),
      });

      expect(response.status).toBe(401);
    });

    it('should return 401 for invalid password', async () => {
      const response = await app.request('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'testuser@example.com',
          password: 'WrongPassword',
        }),
      });

      expect(response.status).toBe(401);
    });
  });
});
