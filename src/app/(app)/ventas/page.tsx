import Link from 'next/link'
import { requireRole } from '@/server/auth/guards'
import { listSales, SALES_PAGE_SIZE } from '@/server/queries/sales'
import { SalesList } from '@/components/ventas/SalesList'
import { Button } from '@/components/ui/button'
import { Pagination } from '@/components/ui/pagination'

export default async function VentasPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireRole(['ADMIN', 'VENDEDOR'])
  const sp = await searchParams
  const page = Math.max(1, Math.floor(Number(sp.page ?? '1')) || 1)
  const { rows: sales, total } = await listSales({ page })
  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Ventas ({total})</h1>
        <Link href="/ventas/nueva"><Button>+ Nueva venta</Button></Link>
      </div>
      <SalesList sales={sales} />
      <Pagination page={page} pageSize={SALES_PAGE_SIZE} total={total} basePath="/ventas" />
    </section>
  )
}
