import Link from 'next/link'
import type { VendedorDashboardStats } from '@/server/queries/dashboard'
import type { Period } from '@/lib/period'
import { PeriodSelector } from './PeriodSelector'
import { FilterTransition, PendingFade } from '@/components/ui/filter-transition'
import { StatCard } from './StatCard'
import { integer } from '@/lib/format'

export function VendedorDashboard({ stats, period }: { stats: VendedorDashboardStats; period: Period }) {
  return (
    <section>
      <h1 className="text-xl font-semibold mb-4">Inicio</h1>
      <FilterTransition>
        <PeriodSelector period={period} />
        <PendingFade>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Pedidos" value={integer(stats.cantidadPedidos)} />
          </div>
          {stats.reservasListas > 0 && (
            <Link href="/reservas?tab=listas" className="mt-4 block border border-success rounded-lg p-3 min-h-11 text-sm font-medium">
              {stats.reservasListas} {stats.reservasListas === 1 ? 'reserva lista' : 'reservas listas'} para avisar
            </Link>
          )}
        </PendingFade>
      </FilterTransition>
    </section>
  )
}
