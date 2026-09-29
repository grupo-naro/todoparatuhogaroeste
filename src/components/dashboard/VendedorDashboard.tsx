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
        </PendingFade>
      </FilterTransition>
    </section>
  )
}
