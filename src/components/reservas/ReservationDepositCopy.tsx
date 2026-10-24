import type { ReservationDetail } from '@/server/queries/reservations'
import { formatDate, integer } from '@/lib/format'
import { itemNote } from './ReservationDocument'

// Hoja para el depósito: se pega en el producto reservado. Una por reserva, con todos los productos.
export function ReservationDepositCopy({ reservation }: { reservation: ReservationDetail }) {
  return (
    <div className="a4-sheet flex flex-col items-center gap-6 border border-border rounded-lg p-4 text-center print:gap-8 print:border-0 print:rounded-none print:p-[15mm] print:w-full print:min-h-[296mm] print:[box-decoration-break:clone]">
      <p className="text-5xl font-bold uppercase tracking-widest print:text-8xl">Reservado</p>
      <p className="text-3xl font-semibold print:text-5xl">Reserva N° {reservation.number}</p>
      <p className="text-2xl font-medium print:text-4xl">{reservation.customerName || 'Sin nombre'}</p>
      <ul className="w-full text-left space-y-2 print:space-y-3 print:text-2xl">
        {reservation.items.map((item) => (
          <li key={item.variantId} className="flex items-baseline justify-between gap-4 border-b border-foreground pb-1 break-inside-avoid">
            <span>{integer(item.quantity)} × {item.productName} · {item.variantName}</span>
            <span className="shrink-0 text-sm font-semibold uppercase print:text-xl">
              {item.allocated >= item.quantity ? itemNote(item) : 'Esperando'}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-auto text-muted print:text-xl">{formatDate(reservation.createdAt)}</p>
    </div>
  )
}
