import 'server-only'
import { z } from 'zod'
import { prisma } from '@/server/db'

const categoryIdSchema = z.string().uuid()

export type PublicCatalogVariant = { id: string; name: string; disponible: boolean }

export type PublicCatalogProduct = {
  id: string; name: string
  images: { url: string }[]
  variants: PublicCatalogVariant[]
}

export async function listPublicCatalog(filters: { categoryId?: string; q?: string } = {}): Promise<PublicCatalogProduct[]> {
  const { categoryId, q } = filters
  const validCategoryId = categoryId && categoryIdSchema.safeParse(categoryId).success ? categoryId : undefined
  const term = q?.trim()
  const like = term ? { contains: term, mode: 'insensitive' as const } : undefined

  const products = await prisma.product.findMany({
    where: {
      ...(validCategoryId ? { categoryId: validCategoryId } : {}),
      ...(like ? { OR: [{ name: like }, { variants: { some: { name: like } } }] } : {}),
    },
    select: {
      id: true,
      name: true,
      images: { select: { url: true }, orderBy: { order: 'asc' } },
      variants: {
        select: { id: true, name: true, stock: { select: { quantity: true } } },
      },
    },
    orderBy: { name: 'asc' },
  })

  return products.map((p) => ({
    id: p.id,
    name: p.name,
    images: p.images,
    variants: p.variants.map((v) => ({
      id: v.id, name: v.name, disponible: (v.stock?.quantity ?? 0) > 0,
    })),
  }))
}
