import { listStock } from '@/server/queries/inventory'
import { listCategoryOptions } from '@/server/queries/categories'
import { StockFilters } from '@/components/deposito/StockFilters'
import { StockList } from '@/components/deposito/StockList'

type SP = {
  q?: string; categoryId?: string; status?: 'todos' | 'disponible' | 'sin_stock'
  sort?: 'producto' | 'stock' | 'precio'; dir?: 'asc' | 'desc'
}

export default async function DepositoPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const [{ rows, totalVariants, totalUnits }, categories] = await Promise.all([
    listStock(sp),
    listCategoryOptions(),
  ])
  return (
    <section>
      <h1 className="text-xl font-semibold mb-4">Depósito</h1>
      <StockFilters categories={categories} />
      <StockList
        rows={rows}
        totalVariants={totalVariants}
        totalUnits={totalUnits}
        sort={sp.sort}
        dir={sp.dir}
      />
    </section>
  )
}
