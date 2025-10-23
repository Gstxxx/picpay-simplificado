import { z } from 'zod'

export const zTransferSchema = z.object({
  value: z.number().positive('Value must be greater than 0'),
  payer: z.string().uuid('Invalid payer ID'),
  payee: z.string().uuid('Invalid payee ID'),
})