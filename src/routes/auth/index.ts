import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import * as bcrypt from 'bcrypt';
import { sign } from "hono/jwt";
import prisma from '../../lib/prisma.js';
import { zLoginSchema, zRegisterSchema } from './schema.js';

const JWT_SECRET = process.env.JWT_SECRET;

const authApp = new Hono()
  .basePath("/auth")
  .post("/login", zValidator("json", zLoginSchema), async (c) => {
    try {
      const data = c.req.valid("json");
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { email: data.email },
            { documentNumber: data.email },
          ],
        },
      });

      if (!user) {
        return c.json({ error: "Invalid credentials" }, 401);
      }

      const verifyPassword = await bcrypt.compare(data.password, user.password);

      if (!verifyPassword) {
        return c.json({ error: "Invalid credentials" }, 401);
      }

      const payload = {
        sub: user.id,
        role: user.documentType,
        exp: Math.floor(Date.now() / 1000) + 60 * 15,
      };
      if (!JWT_SECRET) {
        return c.json(
          { error: "Missing JWT_SECRET environment variable" },
          500,
        );
      }
      const token = await sign(payload, JWT_SECRET);

      const { password: _, ...userWithoutPassword } = user;

      await prisma.user.update({
        where: { id: user.id },
        data: { updatedAt: new Date() },
      });

      return c.json({ token, user: userWithoutPassword }, 200);
    } catch (err) {
      console.error(err);
      return c.json({ error: "Internal server error" }, 500);
    }
  })
  .post("/register", zValidator("json", zRegisterSchema), async (c) => {
    try {
      const data = c.req.valid("json");

      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            { email: data.email },
            { documentNumber: data.documentNumber },
          ],
        },
      });

      if (existingUser) {
        return c.json(
          { error: "Email or document number already registered" },
          409,
        );
      }

      const hashedPassword = await bcrypt.hash(data.password, 10);

      const user = await prisma.user.create({
        data: {
          email: data.email,
          password: hashedPassword,
          name: data.name,
          documentType: data.documentType,
          documentNumber: data.documentNumber,
          cpf: data.cpf,
        },
      });

      const { password: _, ...userWithoutPassword } = user;

      return c.json({ user: userWithoutPassword }, 201);
    } catch (err) {
      console.error(err);
      return c.json({ error: "Internal server error" }, 500);
    }
  });

export { authApp };