import Link from 'next/link'
import { requireRole } from '@/server/auth/guards'
import {
  countReadyReservations, listReservations, listUnresolvedDeposits, RESERVATIONS_PAGE_SIZE, type ReservationTab,
} from '@/server/queries/reservations'
import { ReservationList } from '@/components/reservas/ReservationList'
import { ReservationTabs } from '@/components/reservas/ReservationTabs'
import { Button } from '@/components/ui/button'
import { Pagination } from '@/components/ui/pagination'

export default async function ReservasPage({ searchParams }: { searchParams: Promise<{ tab?: string; page?: string }> }) {
  const session = await requireRole(['ADMIN', 'VENDEDOR'])
  const sp = await searchParams
  const tab: ReservationTab = sp.tab === 'listas' || sp.tab === 'cerradas' ? sp.tab : 'esperando'
  const page = Math.max(1, Math.floor(Number(sp.page ?? '1')) || 1)
  const userId = session.role === 'VENDEDOR' ? session.sub : undefined
  const [{ rows, total }, readyCount, unresolved] = await Promise.all([
    listReservations({ tab, userId, page }),
    countReadyReservations(userId),
    tab === 'cerradas' && !userId ? listUnresolvedDeposits() : Promise.resolve([]),
  ])
  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Reservas</h1>
        <Link href="/reservas/nueva"><Button>+ Nueva reserva</Button></Link>
      </div>
      <ReservationTabs tab={tab} readyCount={readyCount} />
      {unresolved.length > 0 && (
        <div className="mb-4 border border-danger rounded-lg p-3">
          <p className="font-medium text-danger mb-2">Señas sin resolver ({unresolved.length})</p>
          <ReservationList rows={unresolved} />
        </div>
      )}
      <ReservationList rows={rows} />
      <Pagination page={page} pageSize={RESERVATIONS_PAGE_SIZE} total={total} basePath="/reservas" query={{ tab }} />
    </section>
  )
}
