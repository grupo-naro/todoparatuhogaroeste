import Link from 'next/link'
import type { AdminDashboardStats } from '@/server/queries/dashboard'
import type { Period } from '@/lib/period'
import { PeriodSelector } from './PeriodSelector'
import { FilterTransition, PendingFade } from '@/components/ui/filter-transition'
import { StatCard } from './StatCard'
import { money, integer } from '@/lib/format'

export function AdminDashboard({ stats, period }: { stats: AdminDashboardStats; period: Period }) {
  return (
    <section>
      <h1 className="text-xl font-semibold mb-4">Inicio</h1>
      <FilterTransition>
      <PeriodSelector period={period} />
      <PendingFade>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mb-6">
        <StatCard label="Total facturado" value={money(stats.totalFacturado)} />
        <StatCard label="Ventas" value={integer(stats.cantidadVentas)} />
        <StatCard label="Señas cobradas" value={money(stats.senasCobradas)} />
        <StatCard label="Clientes nuevos" value={integer(stats.clientesNuevos)} />
        <StatCard label="Ventas anuladas" value={integer(stats.ventasAnuladas)} />
      </div>
      {(stats.reservasListas > 0 || stats.senasSinResolver > 0) && (
        <div className="flex flex-col gap-2 mb-6">
          {stats.reservasListas > 0 && (
            <Link href="/reservas?tab=listas" className="border border-success rounded-lg p-3 min-h-11 text-sm font-medium">
              {stats.reservasListas} {stats.reservasListas === 1 ? 'reserva lista' : 'reservas listas'} para avisar
            </Link>
          )}
          {stats.senasSinResolver > 0 && (
            <Link href="/reservas?tab=cerradas" className="border border-danger rounded-lg p-3 min-h-11 text-sm font-medium text-danger">
              {stats.senasSinResolver} {stats.senasSinResolver === 1 ? 'seña sin resolver' : 'señas sin resolver'}
            </Link>
          )}
        </div>
      )}
      <h2 className="text-lg font-semibold mb-2">Stock bajo</h2>
      {stats.stockBajo.length === 0 ? (
        <p className="text-muted">Todo con stock</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {stats.stockBajo.map((v) => (
            <li key={v.variantId} className="flex items-center justify-between border border-border rounded-lg p-3">
              <span>{v.productName} · {v.variantName}</span>
              <span className="text-sm text-muted">Quedan {v.quantity}</span>
            </li>
          ))}
        </ul>
      )}
      </PendingFade>
      </FilterTransition>
    </section>
  )
}
