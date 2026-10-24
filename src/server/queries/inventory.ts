import 'server-only'
import { prisma } from '@/server/db'
import { effectiveCost, effectivePrice, toNumber } from '@/lib/pricing'
import { reservedUnitsByVariant } from '@/server/reservations/stock'
import { expireOverdueReservations } from '@/server/reservations/expiry'

export type StockRow = {
  variantId: string; productName: string; variantName: string; categoryName: string
  quantity: number; reserved: number; available: number
  unitCost: number | null; unitPrice: number | null
}

export async function listStock(params: {
  q?: string; categoryId?: string
  status?: 'todos' | 'disponible' | 'sin_stock'
  sort?: 'producto' | 'stock' | 'precio'; dir?: 'asc' | 'desc'
} = {}) {
  await expireOverdueReservations()
  const term = params.q?.trim()
  const like = term ? { contains: term, mode: 'insensitive' as const } : undefined
  const variants = await prisma.productVariant.findMany({
    where: {
      product: { ...(params.categoryId ? { categoryId: params.categoryId } : {}) },
      ...(like ? { OR: [{ name: like }, { product: { name: like } }] } : {}),
    },
    include: {
      stock: true,
      product: { select: { name: true, defaultCost: true, defaultPrice: true, category: { select: { name: true } } } },
    },
    orderBy: [{ product: { name: 'asc' } }, { name: 'asc' }],
  })

  const reservedMap = await reservedUnitsByVariant(variants.map((v) => v.id))
  let rows: StockRow[] = variants.map((v) => ({
    variantId: v.id, productName: v.product.name, variantName: v.name,
    categoryName: v.product.category.name,
    quantity: v.stock?.quantity ?? 0,
    reserved: reservedMap.get(v.id) ?? 0,
    available: Math.max(0, (v.stock?.quantity ?? 0) - (reservedMap.get(v.id) ?? 0)),
    unitCost: effectiveCost({ cost: toNumber(v.cost) }, { defaultCost: toNumber(v.product.defaultCost) }),
    unitPrice: effectivePrice({ price: toNumber(v.price) }, { defaultPrice: toNumber(v.product.defaultPrice) }),
  }))

  if (params.status === 'disponible') rows = rows.filter((r) => r.available > 0)
  else if (params.status === 'sin_stock') rows = rows.filter((r) => r.available === 0)

  if (params.sort) {
    const dir = params.dir === 'desc' ? -1 : 1
    rows.sort((a, b) => {
      const [x, y] = params.sort === 'stock' ? [a.quantity, b.quantity]
        : params.sort === 'precio' ? [a.unitPrice ?? 0, b.unitPrice ?? 0]
        : [a.productName.localeCompare(b.productName), 0]
      return (typeof x === 'number' ? x - (y as number) : x) * dir
    })
  }

  return {
    rows,
    totalVariants: rows.length,
    totalUnits: rows.reduce((s, r) => s + r.quantity, 0),
  }
}

export async function getVariantStock(variantId: string): Promise<number> {
  const s = await prisma.inventoryStock.findUnique({ where: { variantId } })
  return s?.quantity ?? 0
}
