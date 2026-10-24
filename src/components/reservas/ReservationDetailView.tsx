import type { ReservationDetail } from '@/server/queries/reservations'
import { Badge } from '@/components/ui/badge'
import { PAYMENT_METHOD_LABELS } from '@/lib/constants'
import { money, formatDate } from '@/lib/format'
import { ReservationActions } from './ReservationActions'
import { itemNote } from './ReservationDocument'

const STATUS_LABEL: Record<ReservationDetail['status'], string> = {
  ESPERANDO: 'Esperando stock', LISTA: 'Lista para avisar', CONCRETADA: 'Concretada', CANCELADA: 'Cancelada', VENCIDA: 'Vencida',
}

export function ReservationDetailView({ reservation: r }: { reservation: ReservationDetail }) {
  const total = r.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
  return (
    <section className="flex flex-col gap-4 max-w-2xl">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Reserva N° {r.number}</h1>
        <Badge tone={r.status === 'LISTA' ? 'success' : r.status === 'CANCELADA' || r.status === 'VENCIDA' ? 'danger' : 'neutral'}>
          {STATUS_LABEL[r.status]}
        </Badge>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted">Clienta</dt><dd>{r.customerName ?? '—'}{r.customerPhone ? ` · ${r.customerPhone}` : ''}</dd>
        {r.shippingAddress && (<><dt className="text-muted">Envío a</dt><dd>{r.shippingAddress}</dd></>)}
        {r.note && (<><dt className="text-muted">Nota</dt><dd>{r.note}</dd></>)}
        <dt className="text-muted">Vendedora</dt><dd>{r.userName}</dd>
        <dt className="text-muted">Creada</dt><dd>{formatDate(r.createdAt)}</dd>
        {r.readyAt && (<><dt className="text-muted">Quedó lista</dt><dd>{formatDate(r.readyAt)}{r.notifiedAt ? ` · avisada ${formatDate(r.notifiedAt)}` : ' · sin avisar'}</dd></>)}
        {r.depositResolution && (<><dt className="text-muted">Seña</dt><dd>{r.depositResolution === 'DEVUELTA' ? 'Devuelta' : 'Retenida'}</dd></>)}
      </dl>

      <ReservationActions reservation={r} />

      <div>
        <h2 className="font-semibold mb-2">Productos</h2>
        <ul className="flex flex-col gap-2">
          {r.items.map((i) => (
            <li key={i.variantId} className="flex items-center justify-between gap-3 border border-border rounded-lg p-3">
              <div>
                <p className="text-sm font-medium">{i.quantity} × {i.productName} · {i.variantName}</p>
                <p className="text-xs text-muted">{money(i.unitPrice)} c/u</p>
              </div>
              <span className={i.allocated >= i.quantity ? 'text-success text-sm font-medium' : 'text-muted text-sm'}>
                {itemNote(i)}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-right mt-2 font-semibold">Total: {money(total)}</p>
      </div>

      <div>
        <h2 className="font-semibold mb-2">Señas</h2>
        {r.payments.length === 0 ? (
          <p className="text-sm text-muted">Sin seña</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {r.payments.map((p) => (
              <li key={p.id} className="flex justify-between gap-2">
                <span>{p.kind === 'SENA' ? 'Seña' : 'Devolución'} · {PAYMENT_METHOD_LABELS[p.paymentMethod]} · {formatDate(p.createdAt)}</span>
                <span className={p.kind === 'DEVOLUCION' ? 'text-danger' : ''}>{p.kind === 'DEVOLUCION' ? '−' : ''}{money(p.amount)}</span>
              </li>
            ))}
            <li className="flex justify-between font-semibold border-t border-border pt-1">
              <span>Seña neta</span><span>{money(r.depositBalance)}</span>
            </li>
          </ul>
        )}
      </div>
    </section>
  )
}
