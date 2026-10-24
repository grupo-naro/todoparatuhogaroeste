import type { ReservationDetail } from '@/server/queries/reservations'
import { DocumentSheet } from '@/components/ventas/DocumentSheet'

export function itemNote(item: { quantity: number; allocated: number }): string {
  if (item.allocated >= item.quantity) return 'Apartado'
  if (item.allocated > 0) return `Apartadas ${item.allocated} de ${item.quantity}`
  return 'Esperando stock'
}

export function ReservationDocument({ reservation }: { reservation: ReservationDetail }) {
  const total = reservation.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
  const deposit = reservation.depositBalance
  return (
    <DocumentSheet
      title="Reserva"
      referenceLabel={`Reserva N° ${reservation.number}`}
      date={reservation.createdAt}
      customerName={reservation.customerName}
      address={reservation.shippingAddress}
      lines={reservation.items.map((i) => ({
        description: `${i.productName} · ${i.variantName}`, quantity: i.quantity, unitPrice: i.unitPrice,
        subtotal: i.unitPrice * i.quantity, note: itemNote(i),
      }))}
      total={total}
      totalLabel="Total"
      depositAmount={deposit > 0 ? deposit : undefined}
      balance={deposit > 0 ? total - deposit : undefined}
      legend={<p className="text-xs text-muted text-center print:text-[9pt]">Te avisamos apenas esté todo listo para retirar. Los productos reservados quedan guardados a tu nombre.</p>}
    />
  )
}
