import 'server-only'
import { prisma } from '@/server/db'

export type PublicCatalogVariant = { id: string; name: string; disponible: boolean }

export type PublicCatalogProduct = {
  id: string; name: string
  images: { url: string }[]
  variants: PublicCatalogVariant[]
}

export async function listPublicCatalog(categoryId?: string): Promise<PublicCatalogProduct[]> {
  const products = await prisma.product.findMany({
    where: categoryId ? { categoryId } : undefined,
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
