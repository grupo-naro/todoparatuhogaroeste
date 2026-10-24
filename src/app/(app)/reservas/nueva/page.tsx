import { requireRole } from '@/server/auth/guards'
import { ReservationForm } from '@/components/reservas/ReservationForm'

export default async function NuevaReservaPage() {
  await requireRole(['ADMIN', 'VENDEDOR'])
  return (
    <section>
      <h1 className="text-xl font-semibold mb-4">Nueva reserva</h1>
      <ReservationForm />
    </section>
  )
}
