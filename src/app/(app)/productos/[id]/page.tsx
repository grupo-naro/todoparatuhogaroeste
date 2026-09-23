import { notFound } from 'next/navigation'
import { requireRole } from '@/server/auth/guards'
import { getProduct } from '@/server/queries/products'
import { listCategoryOptions } from '@/server/queries/categories'
import { ProductForm } from '@/components/forms/ProductForm'
import { toNumber } from '@/lib/pricing'

export default async function EditarProductoPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(['ADMIN', 'DEPOSITO'])
  const { id } = await params
  const [product, categories] = await Promise.all([getProduct(id), listCategoryOptions()])
  if (!product) notFound()
  // `getProduct`'s money columns type as Prisma `Decimal | null` — not
  // structurally a `number | string | null`, which is what the (client)
  // `ProductForm`'s local `ProductDetail` type declares (it can't import the
  // server-only query module to reuse its type). Convert explicitly here
  // rather than passing Decimal instances through the prop boundary.
  const detail = {
    ...product,
    defaultCost: toNumber(product.defaultCost),
    defaultPrice: toNumber(product.defaultPrice),
    variants: product.variants.map((v) => ({
      ...v,
      cost: toNumber(v.cost),
      price: toNumber(v.price),
    })),
  }
  return (
    <section className="max-w-2xl">
      <h1 className="text-xl font-semibold mb-4">{product.name}</h1>
      <ProductForm mode="edit" product={detail} categories={categories} />
    </section>
  )
}
