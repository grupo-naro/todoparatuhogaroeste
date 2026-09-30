import { notFound } from 'next/navigation'
import { requireRole } from '@/server/auth/guards'
import { getSale } from '@/server/queries/sales'
import { SaleReceipt } from '@/components/ventas/SaleReceipt'

export default async function VentaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(['ADMIN', 'VENDEDOR'])
  const { id } = await params
  const sale = await getSale(id, { userId: session.role === 'VENDEDOR' ? session.sub : undefined })
  if (!sale) notFound()
  return <SaleReceipt sale={sale} />
}
