import type { PublicCatalogProduct } from '@/server/queries/catalog'
import { ProductCard } from './ProductCard'

export function ProductGrid({ products }: { products: PublicCatalogProduct[] }) {
  if (products.length === 0) {
    return <p className="text-center text-muted py-8">No hay productos en esta categoría</p>
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((p) => <ProductCard key={p.id} product={p} />)}
    </div>
  )
}
