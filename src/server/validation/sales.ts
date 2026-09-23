import { z } from 'zod'
import { PAYMENT_METHODS } from '@/lib/constants'

export const saleItemInputSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.coerce.number().int('Debe ser un entero').min(1, 'Mínimo 1 unidad'),
})

export const createSaleSchema = z.object({
  items: z.array(saleItemInputSchema).min(1, 'Agregá al menos un producto'),
  paymentMethod: z.enum(PAYMENT_METHODS, { message: 'Elegí un método de pago' }),
  customerPhone: z.string().trim().optional(),
  customerName: z.string().trim().optional(),
})
