import { notFound } from 'next/navigation'
import { requireRole } from '@/server/auth/guards'
import { getReservation } from '@/server/queries/reservations'
import { ReservationDetailView } from '@/components/reservas/ReservationDetailView'

export default async function ReservaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(['ADMIN', 'VENDEDOR'])
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const reservation = await getReservation(id, { userId: session.role === 'VENDEDOR' ? session.sub : undefined })
  if (!reservation) notFound()
  return <ReservationDetailView reservation={reservation} />
}
