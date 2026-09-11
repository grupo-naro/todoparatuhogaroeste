type Num = number | string | null | undefined
const n = (v: Num): number | null => {
  if (v === null || v === undefined || v === '') return null
  const x = typeof v === 'string' ? Number(v) : v
  return Number.isNaN(x) ? null : x
}

export function toNumber(v: Num): number | null {
  return n(v)
}

export function effectiveCost(
  variant: { cost: Num },
  product: { defaultCost: Num },
): number | null {
  return n(variant.cost) ?? n(product.defaultCost)
}
export function effectivePrice(
  variant: { price: Num },
  product: { defaultPrice: Num },
): number | null {
  return n(variant.price) ?? n(product.defaultPrice)
}

export function variantDisplayName(v: {
  name?: string | null
  medida?: string | null
  tela?: string | null
  color?: string | null
}): string {
  if (v.name && v.name.trim()) return v.name.trim()
  const parts = [v.medida, v.tela, v.color].map((s) => s?.trim()).filter(Boolean)
  return parts.length ? parts.join(' · ') : 'Única'
}
