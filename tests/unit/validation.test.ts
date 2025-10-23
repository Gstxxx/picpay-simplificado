import { describe, it, expect } from 'vitest';
import { zTransferSchema } from '../../src/routes/transactions/schema.js';
import { zLoginSchema, zRegisterSchema } from '../../src/routes/auth/schema.js';

describe('Transfer Schema Validation', () => {
  it('should validate valid transfer data', () => {
    const validData = {
      payer: '123e4567-e89b-12d3-a456-426614174000',
      payee: '123e4567-e89b-12d3-a456-426614174001',
      value: 10000,
    };

    const result = zTransferSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should reject non-UUID payer', () => {
    const invalidData = {
      payer: 'not-a-uuid',
      payee: '123e4567-e89b-12d3-a456-426614174001',
      value: 10000,
    };

    const result = zTransferSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject negative value', () => {
    const invalidData = {
      payer: '123e4567-e89b-12d3-a456-426614174000',
      payee: '123e4567-e89b-12d3-a456-426614174001',
      value: -100,
    };

    const result = zTransferSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject float value', () => {
    const invalidData = {
      payer: '123e4567-e89b-12d3-a456-426614174000',
      payee: '123e4567-e89b-12d3-a456-426614174001',
      value: 100.5,
    };

    const result = zTransferSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});

describe('Login Schema Validation', () => {
  it('should validate email login', () => {
    const validData = {
      email: 'user@example.com',
      password: 'password123',
    };

    const result = zLoginSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should validate CPF login', () => {
    const validData = {
      email: '12345678901',
      password: 'password123',
    };

    const result = zLoginSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should reject invalid email format', () => {
    const invalidData = {
      email: 'not-an-email',
      password: 'password123',
    };

    const result = zLoginSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});

describe('Register Schema Validation', () => {
  it('should validate COMMON user registration', () => {
    const validData = {
      email: 'user@example.com',
      password: 'SecurePass123',
      confirmPassword: 'SecurePass123',
      name: 'John Doe',
      documentType: 'COMMON' as const,
      documentNumber: '12345678901',
    };

    const result = zRegisterSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should validate MERCHANT user registration', () => {
    const validData = {
      email: 'merchant@example.com',
      password: 'SecurePass123',
      confirmPassword: 'SecurePass123',
      name: 'Acme Corp',
      documentType: 'MERCHANT' as const,
      documentNumber: '12345678901234',
    };

    const result = zRegisterSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should reject weak password', () => {
    const invalidData = {
      email: 'user@example.com',
      password: 'weak',
      confirmPassword: 'weak',
      name: 'John Doe',
      documentType: 'COMMON' as const,
      documentNumber: '12345678901',
    };

    const result = zRegisterSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject password mismatch', () => {
    const invalidData = {
      email: 'user@example.com',
      password: 'SecurePass123',
      confirmPassword: 'DifferentPass123',
      name: 'John Doe',
      documentType: 'COMMON' as const,
      documentNumber: '12345678901',
    };

    const result = zRegisterSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject COMMON with CNPJ', () => {
    const invalidData = {
      email: 'user@example.com',
      password: 'SecurePass123',
      confirmPassword: 'SecurePass123',
      name: 'John Doe',
      documentType: 'COMMON' as const,
      documentNumber: '12345678901234',
    };

    const result = zRegisterSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject MERCHANT with CPF', () => {
    const invalidData = {
      email: 'merchant@example.com',
      password: 'SecurePass123',
      confirmPassword: 'SecurePass123',
      name: 'Acme Corp',
      documentType: 'MERCHANT' as const,
      documentNumber: '12345678901',
    };

    const result = zRegisterSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});
