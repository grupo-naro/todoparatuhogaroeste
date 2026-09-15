import 'server-only'
import { prisma } from '@/server/db'
import { toNumber } from '@/lib/pricing'

export type ProductRow = {
  id: string; name: string; categoryName: string; variantCount: number
  defaultCost: number | null; defaultPrice: number | null; coverImageUrl: string | null
}

export async function listProducts(params: {
  q?: string; categoryId?: string; page?: number; pageSize?: number
}) {
  const pageSize = params.pageSize ?? 25
  const page = Math.max(1, params.page ?? 1)
  const where = {
    ...(params.categoryId ? { categoryId: params.categoryId } : {}),
    ...(params.q && params.q.trim()
      ? { name: { contains: params.q.trim(), mode: 'insensitive' as const } }
      : {}),
  }
  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where, orderBy: { name: 'asc' }, skip: (page - 1) * pageSize, take: pageSize,
      include: {
        category: { select: { name: true } },
        _count: { select: { variants: true } },
        images: { where: { order: 0 }, select: { url: true }, take: 1 },
      },
    }),
    prisma.product.count({ where }),
  ])
  return {
    rows: rows.map((p): ProductRow => ({
      id: p.id, name: p.name, categoryName: p.category.name, variantCount: p._count.variants,
      defaultCost: toNumber(p.defaultCost), defaultPrice: toNumber(p.defaultPrice),
      coverImageUrl: p.images[0]?.url ?? null,
    })),
    total,
  }
}

export async function getProduct(id: string) {
  return prisma.product.findUnique({
    where: { id },
    include: {
      category: { select: { id: true, name: true } },
      variants: { orderBy: { createdAt: 'asc' }, include: { stock: true } },
      images: { orderBy: { order: 'asc' } },
    },
  })
}

export type VariantOption = {
  variantId: string; productName: string; variantName: string; categoryName: string
}

export async function searchProductVariants(q: string, limit = 20): Promise<VariantOption[]> {
  const term = q.trim()
  if (term.length < 2) return []
  const like = { contains: term, mode: 'insensitive' as const }
  const rows = await prisma.productVariant.findMany({
    where: {
      OR: [
        { name: like }, { medida: like }, { tela: like }, { color: like },
        { product: { name: like } },
      ],
    },
    take: limit, orderBy: [{ product: { name: 'asc' } }, { name: 'asc' }],
    include: { product: { select: { name: true, category: { select: { name: true } } } } },
  })
  return rows.map((v) => ({
    variantId: v.id, productName: v.product.name, variantName: v.name, categoryName: v.product.category.name,
  }))
}
