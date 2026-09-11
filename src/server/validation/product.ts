import { z } from 'zod'

const moneyField = z.preprocess(
  (v) => (v === '' || v == null ? null : v),
  z.coerce.number({ message: 'Monto inválido' }).min(0, 'No puede ser negativo').nullable(),
)

export const productSchema = z.object({
  name: z.string().trim().min(2, 'Mínimo 2 caracteres').max(120),
  categoryId: z.string().uuid('Elegí una categoría'),
  description: z.string().trim().max(500).nullish(),
  defaultCost: moneyField,
  defaultPrice: moneyField,
})
export type ProductInput = z.infer<typeof productSchema>
