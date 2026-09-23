import Link from 'next/link'
import { requireRole } from '@/server/auth/guards'
import { listProducts } from '@/server/queries/products'
import { listCategoryOptions } from '@/server/queries/categories'
import { ProductFilters } from '@/components/products/ProductFilters'
import { ProductList } from '@/components/products/ProductList'
import { Button } from '@/components/ui/button'

export default async function ProductosPage({
  searchParams,
}: { searchParams: Promise<{ q?: string; categoryId?: string; page?: string }> }) {
  await requireRole(['ADMIN', 'DEPOSITO'])
  const sp = await searchParams
  const page = Number(sp.page ?? '1') || 1
  const [{ rows, total }, categories] = await Promise.all([
    listProducts({ q: sp.q, categoryId: sp.categoryId, page }),
    listCategoryOptions(),
  ])
  return (
    <section>
      <div className="flex items-center justify-between gap-3 mb-4">
        <h1 className="text-xl font-semibold">Productos ({total})</h1>
        <Link href="/productos/nuevo"><Button>Nuevo producto</Button></Link>
      </div>
      <ProductFilters categories={categories} />
      <ProductList rows={rows} />
    </section>
  )
}
