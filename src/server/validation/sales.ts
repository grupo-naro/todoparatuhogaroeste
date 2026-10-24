import { z } from 'zod'
import { PAYMENT_METHODS } from '@/lib/constants'

export const shippingAddressSchema = z.string().trim().max(200, 'La dirección es demasiado larga').optional()

// Descuento por monto sobre el total, opcional, con un motivo libre.
export const discountFields = {
  discount: z.coerce.number().min(0, 'El descuento no puede ser negativo').optional(),
  discountReason: z.string().trim().max(100, 'El motivo es demasiado largo').optional(),
}

export const saleItemInputSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.coerce.number().int('Debe ser un entero').min(1, 'Mínimo 1 unidad'),
})

export const createSaleSchema = z.object({
  items: z.array(saleItemInputSchema).min(1, 'Agregá al menos un producto'),
  paymentMethod: z.enum(PAYMENT_METHODS, { message: 'Elegí un método de pago' }),
  customerPhone: z.string().trim().optional(),
  customerName: z.string().trim().optional(),
  shippingAddress: shippingAddressSchema,
  ...discountFields,
})
