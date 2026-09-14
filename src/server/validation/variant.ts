import { z } from 'zod'

const moneyField = z.preprocess(
  (v) => (v === '' || v == null ? null : v),
  z.coerce.number({ message: 'Monto inválido' }).min(0).nullable(),
)
const text60 = z.string().trim().max(60).nullish()
// El SKU es único a nivel base de datos — a diferencia de medida/tela/color,
// "" (dejarlo en blanco) debe guardarse como null, o dos variantes sin SKU
// chocan entre sí en el índice único.
const skuField = z.preprocess(
  (v) => (v === '' || v == null ? null : v),
  z.string().trim().max(60).nullable(),
)

// Solo lo usan los flujos de alta (crear producto / agregar variante nueva):
// da de alta el stock ahí mismo en vez de un paso aparte en Carga Inicial.
// `updateVariant` no lee este campo — cambiar stock de algo existente sigue
// yendo por Ajuste, que exige motivo y mantiene la trazabilidad.
const stockInicialField = z.preprocess(
  (v) => (v === '' || v == null ? null : v),
  z.coerce.number().int('Debe ser un entero').min(0, 'No puede ser negativo').nullable(),
)

export const variantSchema = z.object({
  name: z.string().trim().max(120).optional(),
  medida: text60,
  tela: text60,
  color: text60,
  cost: moneyField,
  price: moneyField,
  sku: skuField,
  stockInicial: stockInicialField,
})
export type VariantInput = z.infer<typeof variantSchema>
