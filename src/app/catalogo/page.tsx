import { listPublicCatalog } from '@/server/queries/catalog'
import { listCategoryOptions } from '@/server/queries/categories'
import { CatalogFilters } from '@/components/catalogo/CatalogFilters'
import { ProductGrid } from '@/components/catalogo/ProductGrid'
import { FilterTransition, PendingFade } from '@/components/ui/filter-transition'

export const metadata = {
  title: 'Catálogo — Jael Castillo · Todo para tu Hogar',
  description: 'Mirá nuestros productos y consultá por WhatsApp.',
}

export default async function CatalogoPage({ searchParams }: { searchParams: Promise<{ categoria?: string; q?: string }> }) {
  const sp = await searchParams
  const [products, categories] = await Promise.all([
    listPublicCatalog({ categoryId: sp.categoria || undefined, q: sp.q || undefined }),
    listCategoryOptions(),
  ])
  return (
    <section>
      <h1 className="text-xl font-semibold mb-4">Catálogo</h1>
      <FilterTransition>
        <CatalogFilters categories={categories} />
        <PendingFade><ProductGrid products={products} /></PendingFade>
      </FilterTransition>
    </section>
  )
}
