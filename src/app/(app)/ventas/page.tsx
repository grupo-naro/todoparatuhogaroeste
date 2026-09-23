import Link from 'next/link'
import { requireRole } from '@/server/auth/guards'
import { listSales } from '@/server/queries/sales'
import { SalesList } from '@/components/ventas/SalesList'
import { Button } from '@/components/ui/button'

export default async function VentasPage() {
  await requireRole(['ADMIN', 'VENDEDOR'])
  const sales = await listSales()
  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Ventas</h1>
        <Link href="/ventas/nueva"><Button>+ Nueva venta</Button></Link>
      </div>
      <SalesList sales={sales} />
    </section>
  )
}
