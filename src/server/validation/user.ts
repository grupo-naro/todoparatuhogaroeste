import { z } from 'zod'
import { ROLES } from '@/lib/constants'

export const createUserSchema = z.object({
  name: z.string().trim().min(2, 'Mínimo 2 caracteres').max(120, 'Máximo 120 caracteres'),
  email: z.string().trim().email('Email inválido'),
  phone: z.preprocess(
    (v) => (v === '' || v == null ? null : v),
    z.string().trim().max(30).nullable(),
  ),
  role: z.enum(ROLES, { message: 'Rol inválido' }),
  dni: z.string().trim().regex(/^\d{7,8}$/, 'DNI inválido (7 u 8 dígitos)'),
})
