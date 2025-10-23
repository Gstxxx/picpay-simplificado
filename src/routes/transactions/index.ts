import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import prisma from '../../lib/prisma.js';
import { zTransferSchema } from './schema.js';
import { fetchWithResilience } from '../../lib/http.js';
import { config } from '../../config.js';
import { authMiddleware } from '../../middleware/auth.js';
import { rateLimiter } from '../../middleware/rateLimit.js';

const transactionsApp = new Hono()
  .basePath("/transactions")
  .use(authMiddleware)
  .post("/transfer", rateLimiter({ windowMs: 60000, maxRequests: 10 }), zValidator("json", zTransferSchema), async (c) => {
    try {
      const data = c.req.valid("json");
      const payerId = data.payer;
      const payeeId = data.payee;
      const value = data.value;
      const idempotencyKey = c.req.header('Idempotency-Key');

      // Check for existing transaction with this idempotency key
      if (idempotencyKey) {
        const existing = await prisma.transaction.findUnique({
          where: { idempotencyKey },
        });
        if (existing) {
          return c.json({
            message: "Transfer completed successfully",
            transaction: existing
          }, 200);
        }
      }

      if (payerId === payeeId) {
        return c.json({ error: "Payer and payee must be different" }, 400);
      }

      const payer = await prisma.user.findUnique({
        where: { id: payerId },
      });

      if (!payer) {
        return c.json({ error: "Payer not found" }, 404);
      }

      if (payer.documentType === 'MERCHANT') {
        return c.json({ error: "Merchants cannot send money" }, 403);
      }

      const payee = await prisma.user.findUnique({
        where: { id: payeeId },
      });

      if (!payee) {
        return c.json({ error: "Payee not found" }, 404);
      }

      if (payer.balance < value) {
        return c.json({ error: "Insufficient balance" }, 400);
      }

      try {
        const authResponse = await fetchWithResilience(config.AUTH_URL, {
          method: 'GET',
          timeoutMs: 2000,
          retries: 3,
          retryDelayBaseMs: 200,
        });

        if (!authResponse.ok) {
          return c.json({ error: "Authorization service unavailable" }, 503);
        }
        const authData = await authResponse.json();
        const status = authData?.status;
        const authorized = authData?.data?.authorization === true;
        if (status !== 'success' || !authorized) {
          return c.json({ error: "Transaction not authorized" }, 403);
        }
      } catch (err) {
        console.error('Authorization service error:', err);
        return c.json({ error: "Authorization service unavailable" }, 503);
      }

      const transaction = await prisma.$transaction(async (tx) => {
        const debit = await tx.user.updateMany({
          where: { id: payerId, balance: { gte: value } },
          data: { balance: { decrement: value } },
        });
        if (debit.count !== 1) {
          throw new Error('INSUFFICIENT_BALANCE');
        }

        await tx.user.update({
          where: { id: payeeId },
          data: { balance: { increment: value } },
        });

        const newTransaction = await tx.transaction.create({
          data: {
            value,
            payerId,
            payeeId,
            status: 'SUCCESS',
            idempotencyKey: idempotencyKey || null,
          },
        });

        // Add notification to outbox for reliable delivery
        await tx.notificationOutbox.create({
          data: {
            email: payee.email,
            message: `You received a transfer of ${value}`,
            status: 'PENDING',
          },
        });

        return newTransaction;
      }).catch((e) => {
        if (e instanceof Error && e.message === 'INSUFFICIENT_BALANCE') {
          return null;
        }
        throw e;
      });

      if (!transaction) {
        return c.json({ error: "Insufficient balance" }, 400);
      }

      return c.json({
        message: "Transfer completed successfully",
        transaction
      }, 200);
    } catch (err) {
      console.error(err);
      return c.json({ error: "Internal server error" }, 500);
    }
  });

export { transactionsApp };