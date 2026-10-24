import { z } from 'zod'
import { PAYMENT_METHODS } from '@/lib/constants'
import { saleItemInputSchema, shippingAddressSchema } from './sales'

export const depositInputSchema = z.object({
  amount: z.coerce.number().positive('La seña tiene que ser mayor a 0'),
  paymentMethod: z.enum(PAYMENT_METHODS, { message: 'Elegí un método de pago' }),
})

export const createReservationSchema = z.object({
  items: z.array(saleItemInputSchema).min(1, 'Agregá al menos un producto'),
  customerName: z.string().trim().optional(),
  customerPhone: z.string().trim().optional(),
  shippingAddress: shippingAddressSchema,
  note: z.string().trim().max(300, 'La nota es demasiado larga').optional(),
  deposit: depositInputSchema.optional(),
})

export const addDepositSchema = depositInputSchema.extend({ reservationId: z.string().uuid() })
