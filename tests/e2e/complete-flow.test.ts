import { describe, it, expect, beforeAll } from 'vitest';
import { Hono } from 'hono';
import nock from 'nock';
import { authApp } from '../../src/routes/auth/index.js';
import { transactionsApp } from '../../src/routes/transactions/index.js';
import { healthApp } from '../../src/routes/health/index.js';
import { prisma } from '../setup.js';

describe('End-to-End Complete Flow', () => {
  const app = new Hono().route('/', healthApp).route('/', authApp).route('/', transactionsApp);

  beforeAll(() => {
    nock('https://util.devi.tools')
      .get('/api/v2/authorize')
      .reply(200, { status: 'success', data: { authorization: true } })
      .persist();
  });

  it('should complete full user journey: register -> login -> transfer', async () => {
    const user1Data = {
      email: 'alice@example.com',
      password: 'AlicePass123',
      confirmPassword: 'AlicePass123',
      name: 'Alice Smith',
      documentType: 'COMMON',
      documentNumber: '11122233344',
    };

    const registerResponse1 = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user1Data),
    });

    expect(registerResponse1.status).toBe(201);
    const registeredUser1 = await registerResponse1.json();
    const aliceId = registeredUser1.user.id;

    const user2Data = {
      email: 'bob@example.com',
      password: 'BobPass123',
      confirmPassword: 'BobPass123',
      name: 'Bob Jones',
      documentType: 'COMMON',
      documentNumber: '55566677788',
    };

    const registerResponse2 = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user2Data),
    });

    expect(registerResponse2.status).toBe(201);
    const registeredUser2 = await registerResponse2.json();
    const bobId = registeredUser2.user.id;

    await prisma.user.update({
      where: { id: aliceId },
      data: { balance: 100000 },
    });

    const loginResponse = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alice@example.com',
        password: 'AlicePass123',
      }),
    });

    expect(loginResponse.status).toBe(200);
    const loginData = await loginResponse.json();
    const aliceToken = loginData.token;
    expect(aliceToken).toBeDefined();

    const transferResponse = await app.request('/transactions/transfer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`,
      },
      body: JSON.stringify({
        payer: aliceId,
        payee: bobId,
        value: 25000,
      }),
    });

    expect(transferResponse.status).toBe(200);
    const transferData = await transferResponse.json();
    expect(transferData.message).toBe('Transfer completed successfully');
    expect(transferData.transaction.value).toBe(25000);

    const aliceFinal = await prisma.user.findUnique({ where: { id: aliceId } });
    const bobFinal = await prisma.user.findUnique({ where: { id: bobId } });

    expect(aliceFinal?.balance).toBe(75000);
    expect(bobFinal?.balance).toBe(125000);

    const transaction = await prisma.transaction.findUnique({
      where: { id: transferData.transaction.id },
    });

    expect(transaction).toBeDefined();
    expect(transaction?.payerId).toBe(aliceId);
    expect(transaction?.payeeId).toBe(bobId);
    expect(transaction?.status).toBe('SUCCESS');

    const notification = await prisma.notificationOutbox.findFirst({
      where: { email: 'bob@example.com' },
    });

    expect(notification).toBeDefined();
    expect(notification?.status).toBe('PENDING');
    expect(notification?.message).toContain('25000');
  });

  it('should handle merchant receiving payment', async () => {
    const customerData = {
      email: 'customer@example.com',
      password: 'CustomerPass123',
      confirmPassword: 'CustomerPass123',
      name: 'Customer User',
      documentType: 'COMMON',
      documentNumber: '99988877766',
    };

    const customerResponse = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(customerData),
    });

    const customer = await customerResponse.json();
    const customerId = customer.user.id;

    const merchantData = {
      email: 'shop@example.com',
      password: 'ShopPass123',
      confirmPassword: 'ShopPass123',
      name: 'Shop Inc',
      documentType: 'MERCHANT',
      documentNumber: '98765432109876',
    };

    const merchantResponse = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(merchantData),
    });

    const merchant = await merchantResponse.json();
    const merchantId = merchant.user.id;

    await prisma.user.update({
      where: { id: customerId },
      data: { balance: 50000 },
    });

    const loginResponse = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'customer@example.com',
        password: 'CustomerPass123',
      }),
    });

    const loginData = await loginResponse.json();
    const customerToken = loginData.token;

    const paymentResponse = await app.request('/transactions/transfer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        payer: customerId,
        payee: merchantId,
        value: 15000,
      }),
    });

    expect(paymentResponse.status).toBe(200);

    const merchantFinal = await prisma.user.findUnique({ where: { id: merchantId } });
    expect(merchantFinal?.balance).toBe(115000);

    const customerFinal = await prisma.user.findUnique({ where: { id: customerId } });
    expect(customerFinal?.balance).toBe(35000);
  });

  it('should handle concurrent transfers with race condition safety', async () => {
    const bcrypt = await import('bcrypt');
    const hashedPassword = await bcrypt.hash('TestPass123', 10);

    const sender = await prisma.user.create({
      data: {
        email: 'sender@example.com',
        password: hashedPassword,
        name: 'Sender User',
        documentType: 'COMMON',
        documentNumber: '12312312312',
        balance: 10000,
      },
    });

    const receiver1 = await prisma.user.create({
      data: {
        email: 'receiver1@example.com',
        password: hashedPassword,
        name: 'Receiver One',
        documentType: 'COMMON',
        documentNumber: '45645645645',
        balance: 0,
      },
    });

    const receiver2 = await prisma.user.create({
      data: {
        email: 'receiver2@example.com',
        password: hashedPassword,
        name: 'Receiver Two',
        documentType: 'COMMON',
        documentNumber: '78978978978',
        balance: 0,
      },
    });

    const loginResponse = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'sender@example.com',
        password: 'TestPass123',
      }),
    });

    expect(loginResponse.status).toBe(200);
    const loginData = await loginResponse.json();
    const senderToken = loginData.token;

    const transfer1Promise = app.request('/transactions/transfer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${senderToken}`,
      },
      body: JSON.stringify({
        payer: sender.id,
        payee: receiver1.id,
        value: 10000,
      }),
    });

    const transfer2Promise = app.request('/transactions/transfer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${senderToken}`,
      },
      body: JSON.stringify({
        payer: sender.id,
        payee: receiver2.id,
        value: 10000,
      }),
    });

    const [response1, response2] = await Promise.all([transfer1Promise, transfer2Promise]);

    const statuses = [response1.status, response2.status].sort();
    expect(statuses).toEqual([200, 400]);

    const senderFinal = await prisma.user.findUnique({ where: { id: sender.id } });
    expect(senderFinal?.balance).toBe(0);

    const receiver1Final = await prisma.user.findUnique({ where: { id: receiver1.id } });
    const receiver2Final = await prisma.user.findUnique({ where: { id: receiver2.id } });
    const totalReceived = (receiver1Final?.balance || 0) + (receiver2Final?.balance || 0);
    expect(totalReceived).toBe(10000);
  });

  it('should verify health endpoints are accessible', async () => {
    const healthResponse = await app.request('/healthz', {
      method: 'GET',
    });

    expect(healthResponse.status).toBe(200);
    const healthData = await healthResponse.json();
    expect(healthData.status).toBe('ok');

    const readyResponse = await app.request('/readyz', {
      method: 'GET',
    });

    expect(readyResponse.status).toBe(200);
    const readyData = await readyResponse.json();
    expect(readyData.status).toBe('ready');
  });
});
