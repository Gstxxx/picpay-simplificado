import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import prisma from '../../lib/prisma.js';
import { zTransferSchema } from './schema.js';

const transactionsApp = new Hono()
  .basePath("/transactions")
  .post("/transfer", zValidator("json", zTransferSchema), async (c) => {
    try {
      const data = c.req.valid("json");

      const payer = await prisma.user.findUnique({
        where: { id: Number(data.payer) },
      });

      if (!payer) {
        return c.json({ error: "Payer not found" }, 404);
      }

      if (payer.documentType === 'MERCHANT') {
        return c.json({ error: "Merchants cannot send money" }, 403);
      }

      const payee = await prisma.user.findUnique({
        where: { id: Number(data.payee) },
      });

      if (!payee) {
        return c.json({ error: "Payee not found" }, 404);
      }

      if (payer.balance < data.value) {
        return c.json({ error: "Insufficient balance" }, 400);
      }

      try {
        const authResponse = await fetch('https://util.devi.tools/api/v2/authorize');
        const authData = await authResponse.json();

        if (authData.status !== 'success' && authData.data?.authorization !== true) {
          return c.json({ error: "Transaction not authorized" }, 403);
        }
      } catch (err) {
        console.error('Authorization service error:', err);
        return c.json({ error: "Authorization service unavailable" }, 503);
      }

      const transaction = await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: Number(data.payer) },
          data: { balance: { decrement: data.value } },
        });

        await tx.user.update({
          where: { id: Number(data.payee) },
          data: { balance: { increment: data.value } },
        });

        const newTransaction = await tx.transaction.create({
          data: {
            value: data.value,
            payerId: String(data.payer),
            payeeId: String(data.payee),
            status: 'SUCCESS',
          },
        });

        return newTransaction;
      });

      fetch('https://util.devi.tools/api/v1/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: payee.email,
          message: `You received a transfer of ${data.value}`,
        }),
      }).catch((err) => {
        console.error('Notification service error:', err);
      });

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