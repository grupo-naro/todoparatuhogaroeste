import Link from 'next/link'
import type { ReservationRow } from '@/server/queries/reservations'
import { Badge } from '@/components/ui/badge'
import { money, formatDate } from '@/lib/format'

const STATUS_LABEL: Record<ReservationRow['status'], string> = {
  ESPERANDO: 'Esperando stock', LISTA: 'Lista para avisar', CONCRETADA: 'Concretada', CANCELADA: 'Cancelada', VENCIDA: 'Vencida',
}

export function ReservationList({ rows }: { rows: ReservationRow[] }) {
  if (rows.length === 0) return <p className="text-center text-muted py-8">No hay reservas en esta lista</p>
  return (
    <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
      {rows.map((r) => (
        <li key={r.id}>
          <Link href={`/reservas/${r.id}`}
            className="block border border-border rounded-lg bg-card p-3 h-full active:bg-border/40 transition-colors">
            <div className="flex items-start justify-between gap-2">
              <strong>Reserva N° {r.number} · {r.customerName ?? 'Sin nombre'}</strong>
              <Badge tone={r.status === 'LISTA' ? 'success' : r.status === 'CANCELADA' || r.status === 'VENCIDA' ? 'danger' : 'neutral'}>
                {STATUS_LABEL[r.status]}
              </Badge>
            </div>
            <ul className="mt-2 text-sm space-y-0.5">
              {r.items.map((i, idx) => (
                <li key={idx} className="flex justify-between gap-2">
                  <span>{i.quantity} × {i.productName} · {i.variantName}</span>
                  <span className={i.allocated >= i.quantity ? 'text-success' : 'text-muted'}>
                    {i.allocated >= i.quantity ? 'Apartado' : `${i.allocated}/${i.quantity}`}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted flex flex-wrap gap-x-3">
              <span>{formatDate(r.createdAt)} · {r.userName}</span>
              {r.missingUnits > 0 && <span>Faltan {r.missingUnits}</span>}
              {r.depositBalance > 0 && <span>Seña {money(r.depositBalance)}</span>}
              {r.status === 'LISTA' && !r.notifiedAt && <span className="text-danger font-medium">Sin avisar</span>}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  )
}
