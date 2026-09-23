import { notFound } from 'next/navigation'
import { requireRole } from '@/server/auth/guards'
import { getSale } from '@/server/queries/sales'
import { SaleReceipt } from '@/components/ventas/SaleReceipt'

export default async function VentaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(['ADMIN', 'VENDEDOR'])
  const { id } = await params
  const sale = await getSale(id)
  if (!sale) notFound()
  return <SaleReceipt sale={sale} />
}
