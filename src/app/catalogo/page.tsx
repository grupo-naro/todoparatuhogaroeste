import { listPublicCatalog } from '@/server/queries/catalog'
import { listCategoryOptions } from '@/server/queries/categories'
import { CategoryFilter } from '@/components/catalogo/CategoryFilter'
import { ProductGrid } from '@/components/catalogo/ProductGrid'

export const metadata = {
  title: 'Catálogo — Jael Castillo · Todo para tu Hogar',
  description: 'Mirá nuestros productos y consultá por WhatsApp.',
}

export default async function CatalogoPage({ searchParams }: { searchParams: Promise<{ categoria?: string }> }) {
  const sp = await searchParams
  const [products, categories] = await Promise.all([
    listPublicCatalog(sp.categoria || undefined),
    listCategoryOptions(),
  ])
  return (
    <section>
      <h1 className="text-xl font-semibold mb-4">Catálogo</h1>
      <CategoryFilter categories={categories} />
      <ProductGrid products={products} />
    </section>
  )
}
