import { z } from 'zod'

const emailSchema = z.string().email('Invalid email format')

const cpfSchema = z
  .string()
  .regex(/^\d{11}$/, 'CPF must contain exactly 11 digits')

const cnpjSchema = z
  .string()
  .regex(/^\d{14}$/, 'CNPJ must contain exactly 14 digits')

const documentNumberSchema = z.union([cpfSchema, cnpjSchema], {
  errorMap: () => ({ message: 'Must be a valid CPF or CNPJ' }),
})

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')

const zLoginSchema = z.object({
  email: z.union([emailSchema, documentNumberSchema], {
    errorMap: () => ({ message: 'Must be a valid email, CPF, or CNPJ' }),
  }),
  password: z.string().min(1, 'Password is required'),
})

const zRegisterSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Password confirmation is required'),
    name: z
      .string()
      .min(2, 'Name must be at least 2 characters')
      .max(100, 'Name must not exceed 100 characters'),
    documentType: z.enum(['COMMON', 'MERCHANT'], {
      errorMap: () => ({ message: 'Document type must be either COMMON or MERCHANT' }),
    }),
    documentNumber: documentNumberSchema,
    cpf: cpfSchema,
  })
  .refine(data => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine(
    data => {
      if (data.documentType === 'COMMON') {
        return /^\d{11}$/.test(data.documentNumber)
      }
      if (data.documentType === 'MERCHANT') {
        return /^\d{14}$/.test(data.documentNumber)
      }
      return true
    },
    {
      message: 'COMMON users must provide CPF (11 digits), MERCHANT users must provide CNPJ (14 digits)',
      path: ['documentNumber'],
    }
  )

export { zLoginSchema, zRegisterSchema }