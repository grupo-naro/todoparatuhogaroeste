import 'server-only'
import { prisma } from '@/server/db'
import { effectivePrice, toNumber } from '@/lib/pricing'
import type { PaymentMethodName } from '@/lib/constants'

export type SellableVariant = {
  variantId: string; productName: string; variantName: string; categoryName: string
  quantity: number; unitPrice: number | null
}

export async function searchSellableVariants(q: string, limit = 20): Promise<SellableVariant[]> {
  const term = q.trim()
  if (term.length < 2) return []
  const like = { contains: term, mode: 'insensitive' as const }
  const rows = await prisma.productVariant.findMany({
    where: { OR: [{ name: like }, { product: { name: like } }] },
    take: limit,
    orderBy: [{ product: { name: 'asc' } }, { name: 'asc' }],
    include: {
      stock: true,
      product: { select: { name: true, defaultPrice: true, category: { select: { name: true } } } },
    },
  })
  return rows.map((v) => ({
    variantId: v.id, productName: v.product.name, variantName: v.name,
    categoryName: v.product.category.name, quantity: v.stock?.quantity ?? 0,
    unitPrice: effectivePrice({ price: toNumber(v.price) }, { defaultPrice: toNumber(v.product.defaultPrice) }),
  }))
}

export type SaleRow = {
  id: string; number: number; createdAt: Date; userName: string
  paymentMethod: PaymentMethodName; total: number; cancelledAt: Date | null
}

export const SALES_PAGE_SIZE = 25

export async function listSales(
  params: { page?: number; pageSize?: number } = {},
): Promise<{ rows: SaleRow[]; total: number }> {
  const pageSize = params.pageSize ?? SALES_PAGE_SIZE
  const page = Math.max(1, params.page ?? 1)
  const [total, sales] = await Promise.all([
    prisma.sale.count(),
    prisma.sale.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { user: { select: { name: true } } },
    }),
  ])
  const rows = sales.map((s) => ({
    id: s.id, number: s.number, createdAt: s.createdAt, userName: s.user.name,
    paymentMethod: s.paymentMethod, total: toNumber(s.total) ?? 0, cancelledAt: s.cancelledAt,
  }))
  return { rows, total }
}

export type SaleDetailItem = {
  variantId: string; productName: string; variantName: string
  quantity: number; unitPrice: number; subtotal: number
}
export type SaleDetail = {
  id: string; number: number; createdAt: Date; userName: string
  paymentMethod: PaymentMethodName; total: number; cancelledAt: Date | null; cancelledByName: string | null
  items: SaleDetailItem[]
}

export async function getSale(id: string): Promise<SaleDetail | null> {
  const s = await prisma.sale.findUnique({
    where: { id },
    include: {
      user: { select: { name: true } },
      cancelledBy: { select: { name: true } },
      items: { include: { variant: { select: { name: true, product: { select: { name: true } } } } } },
    },
  })
  if (!s) return null
  return {
    id: s.id, number: s.number, createdAt: s.createdAt, userName: s.user.name,
    paymentMethod: s.paymentMethod, total: toNumber(s.total) ?? 0,
    cancelledAt: s.cancelledAt, cancelledByName: s.cancelledBy?.name ?? null,
    items: s.items.map((i) => ({
      variantId: i.variantId, productName: i.variant.product.name, variantName: i.variant.name,
      quantity: i.quantity, unitPrice: toNumber(i.unitPrice) ?? 0, subtotal: toNumber(i.subtotal) ?? 0,
    })),
  }
}
