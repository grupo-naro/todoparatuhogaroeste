import { z } from 'zod'

export const stockRowSchema = z.object({
  variantId: z.string().uuid('Variante inválida'),
  counted: z.coerce.number().int('Debe ser un entero').min(0, 'No puede ser negativo'),
})
export const batchSchema = z.array(stockRowSchema).min(1, 'El lote está vacío')

export const adjustSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.coerce.number().int('Debe ser un entero').min(0, 'No puede ser negativo'),
  note: z.string().trim().min(1, 'El motivo es obligatorio').max(300),
})
