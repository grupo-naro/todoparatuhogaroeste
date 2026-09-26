import { requireRole } from '@/server/auth/guards'
import { SaleCart } from '@/components/ventas/SaleCart'

export default async function NuevaVentaPage() {
  await requireRole(['ADMIN', 'VENDEDOR'])
  return (
    <section>
      <h1 className="text-xl font-semibold mb-4 print:hidden">Nueva venta</h1>
      <SaleCart />
    </section>
  )
}
