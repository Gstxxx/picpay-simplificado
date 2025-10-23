import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { sign } from 'hono/jwt';
import nock from 'nock';
import { transactionsApp } from '../../src/routes/transactions/index.js';
import { prisma } from '../setup.js';
import { config } from '../../src/config.js';

describe('Transfer Integration Tests', () => {
  const app = new Hono().route('/', transactionsApp);
  let payerToken: string;
  let payerId: string;
  let payeeId: string;
  let merchantId: string;

  beforeEach(async () => {
    
    const payer = await prisma.user.create({
      data: {
        email: 'payer@example.com',
        password: 'hashedpassword',
        name: 'Payer User',
        documentType: 'COMMON',
        documentNumber: '11111111111',
        balance: 50000, 
      },
    });
    payerId = payer.id;

    
    const payee = await prisma.user.create({
      data: {
        email: 'payee@example.com',
        password: 'hashedpassword',
        name: 'Payee User',
        documentType: 'COMMON',
        documentNumber: '22222222222',
        balance: 10000, 
      },
    });
    payeeId = payee.id;

    
    const merchant = await prisma.user.create({
      data: {
        email: 'merchant@example.com',
        password: 'hashedpassword',
        name: 'Merchant Corp',
        documentType: 'MERCHANT',
        documentNumber: '12345678901234',
        balance: 0,
      },
    });
    merchantId = merchant.id;

    
    payerToken = await sign(
      {
        sub: payerId,
        role: 'COMMON',
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      config.JWT_SECRET
    );

    
    nock('https:
      .get('/api/v2/authorize')
      .reply(200, { status: 'success', data: { authorization: true } })
      .persist();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('POST /transactions/transfer', () => {
    it('should successfully transfer money between users', async () => {
      const transferData = {
        payer: payerId,
        payee: payeeId,
        value: 10000, 
      };

      const response = await app.request('/transactions/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${payerToken}`,
        },
        body: JSON.stringify(transferData),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toBe('Transfer completed successfully');
      expect(data.transaction).toBeDefined();
      expect(data.transaction.value).toBe(10000);

      
      const updatedPayer = await prisma.user.findUnique({ where: { id: payerId } });
      const updatedPayee = await prisma.user.findUnique({ where: { id: payeeId } });
      expect(updatedPayer?.balance).toBe(40000); 
      expect(updatedPayee?.balance).toBe(20000); 

      
      const notification = await prisma.notificationOutbox.findFirst({
        where: { email: 'payee@example.com' },
      });
      expect(notification).toBeDefined();
      expect(notification?.status).toBe('PENDING');
    });

    it('should reject transfer without authentication', async () => {
      const transferData = {
        payer: payerId,
        payee: payeeId,
        value: 10000,
      };

      const response = await app.request('/transactions/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transferData),
      });

      expect(response.status).toBe(401);
    });

    it('should reject self-transfer', async () => {
      const transferData = {
        payer: payerId,
        payee: payerId,
        value: 10000,
      };

      const response = await app.request('/transactions/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${payerToken}`,
        },
        body: JSON.stringify(transferData),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('different');
    });

    it('should reject transfer with insufficient balance', async () => {
      const transferData = {
        payer: payerId,
        payee: payeeId,
        value: 100000, 
      };

      const response = await app.request('/transactions/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${payerToken}`,
        },
        body: JSON.stringify(transferData),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Insufficient balance');

      
      const payer = await prisma.user.findUnique({ where: { id: payerId } });
      expect(payer?.balance).toBe(50000);
    });

    it('should reject merchant sending money', async () => {
      const merchantToken = await sign(
        {
          sub: merchantId,
          role: 'MERCHANT',
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
        config.JWT_SECRET
      );

      
      await prisma.user.update({
        where: { id: merchantId },
        data: { balance: 50000 },
      });

      const transferData = {
        payer: merchantId,
        payee: payeeId,
        value: 10000,
      };

      const response = await app.request('/transactions/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${merchantToken}`,
        },
        body: JSON.stringify(transferData),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('Merchants cannot send money');
    });

    it('should reject transfer when authorization service denies', async () => {
      nock.cleanAll();
      nock('https:
        .get('/api/v2/authorize')
        .reply(200, { status: 'fail', data: { authorization: false } });

      const transferData = {
        payer: payerId,
        payee: payeeId,
        value: 10000,
      };

      const response = await app.request('/transactions/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${payerToken}`,
        },
        body: JSON.stringify(transferData),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('not authorized');
    });

    it('should handle authorization service unavailable', async () => {
      nock.cleanAll();
      nock('https:

      const transferData = {
        payer: payerId,
        payee: payeeId,
        value: 10000,
      };

      const response = await app.request('/transactions/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${payerToken}`,
        },
        body: JSON.stringify(transferData),
      });

      expect(response.status).toBe(503);
    });

    it('should support idempotency', async () => {
      const idempotencyKey = 'unique-request-id-12345';
      const transferData = {
        payer: payerId,
        payee: payeeId,
        value: 10000,
      };

      
      const response1 = await app.request('/transactions/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${payerToken}`,
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(transferData),
      });

      expect(response1.status).toBe(200);
      const data1 = await response1.json();
      const transactionId = data1.transaction.id;

      
      const response2 = await app.request('/transactions/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${payerToken}`,
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(transferData),
      });

      expect(response2.status).toBe(200);
      const data2 = await response2.json();
      expect(data2.transaction.id).toBe(transactionId);

      
      const payer = await prisma.user.findUnique({ where: { id: payerId } });
      expect(payer?.balance).toBe(40000); 

      
      const transactions = await prisma.transaction.findMany({
        where: { idempotencyKey },
      });
      expect(transactions).toHaveLength(1);
    });

    it('should reject invalid UUID format', async () => {
      const transferData = {
        payer: 'not-a-uuid',
        payee: payeeId,
        value: 10000,
      };

      const response = await app.request('/transactions/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${payerToken}`,
        },
        body: JSON.stringify(transferData),
      });

      expect(response.status).toBe(400);
    });

    it('should reject non-integer value', async () => {
      const transferData = {
        payer: payerId,
        payee: payeeId,
        value: 100.50,
      };

      const response = await app.request('/transactions/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${payerToken}`,
        },
        body: JSON.stringify(transferData),
      });

      expect(response.status).toBe(400);
    });
  });
});

