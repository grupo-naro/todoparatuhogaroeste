import { z } from 'zod'

const moneyField = z.preprocess(
  (v) => (v === '' || v == null ? null : v),
  z.coerce.number({ message: 'Monto inválido' }).min(0).nullable(),
)
const text60 = z.string().trim().max(60).nullish()

export const variantSchema = z.object({
  name: z.string().trim().max(120).optional(),
  medida: text60,
  tela: text60,
  color: text60,
  cost: moneyField,
  price: moneyField,
  sku: z.string().trim().max(60).nullish(),
})
export type VariantInput = z.infer<typeof variantSchema>
