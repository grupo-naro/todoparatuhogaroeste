'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { markReservationNotified, reprintReservation } from '@/server/actions/reservations'
import type { ReservationDetail } from '@/server/queries/reservations'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { buildReservationNotice } from '@/lib/whatsapp'
import { CancelReservationDialog } from './CancelReservationDialog'
import { ConvertReservationDialog } from './ConvertReservationDialog'
import { DepositDialog } from './DepositDialog'

type Dialogs = 'deposit' | 'refund' | 'cancel' | 'convert' | 'resolve' | null

export function ReservationActions({ reservation }: { reservation: ReservationDetail }) {
  const router = useRouter()
  const { toast } = useToast()
  const [dialog, setDialog] = useState<Dialogs>(null)
  const isOpen = reservation.status === 'ESPERANDO' || reservation.status === 'LISTA'
  const unresolvedDeposit =
    (reservation.status === 'CANCELADA' || reservation.status === 'VENCIDA') &&
    reservation.depositResolution === null && reservation.depositBalance > 0
  const canNotify = reservation.status === 'LISTA' && !!reservation.customerPhone

  async function reprint() {
    const res = await reprintReservation(reservation.id)
    if (res.ok) toast('Se mandó a imprimir', 'success')
    else toast(res.error, 'danger')
  }

  async function notified() {
    await markReservationNotified(reservation.id)
    router.refresh()
  }

  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      {isOpen && (
        <>
          <Button onClick={() => setDialog('convert')} disabled={reservation.status !== 'LISTA'}>Concretar venta</Button>
          {canNotify && (
            <a href={buildReservationNotice(reservation.customerPhone!, reservation.customerName, reservation.number)}
              target="_blank" rel="noopener noreferrer" onClick={notified}
              className="inline-flex items-center justify-center rounded border border-border px-3 min-h-11 text-sm font-medium">
              Avisar por WhatsApp
            </a>
          )}
          <Button variant="ghost" className="border border-border" onClick={() => setDialog('deposit')}>Registrar seña</Button>
          {reservation.depositBalance > 0 && (
            <Button variant="ghost" className="border border-border" onClick={() => setDialog('refund')}>Devolver parte de la seña</Button>
          )}
          <Button variant="ghost" className="border border-border" onClick={reprint}>Reimprimir</Button>
          <Button variant="ghost" className="border border-danger text-danger" onClick={() => setDialog('cancel')}>Cancelar reserva</Button>
        </>
      )}
      {unresolvedDeposit && <Button onClick={() => setDialog('resolve')}>Resolver seña</Button>}
      {reservation.status === 'CONCRETADA' && reservation.saleId && (
        <Link href={`/ventas/${reservation.saleId}`}
          className="inline-flex items-center rounded border border-border px-3 min-h-11 text-sm font-medium">
          Ver la venta
        </Link>
      )}
      {reservation.status !== 'ESPERANDO' && reservation.status !== 'LISTA' && <Button variant="ghost" className="border border-border" onClick={reprint}>Reimprimir</Button>}

      <ConvertReservationDialog key={`convert-${reservation.id}`} reservation={reservation}
        open={dialog === 'convert'} onOpenChange={(v) => setDialog(v ? 'convert' : null)} />
      <DepositDialog reservationId={reservation.id} open={dialog === 'deposit'} onOpenChange={(v) => setDialog(v ? 'deposit' : null)} />
      <DepositDialog reservationId={reservation.id} kind="DEVOLUCION" open={dialog === 'refund'} onOpenChange={(v) => setDialog(v ? 'refund' : null)} />
      <CancelReservationDialog reservation={reservation} open={dialog === 'cancel'} onOpenChange={(v) => setDialog(v ? 'cancel' : null)} />
      <CancelReservationDialog reservation={reservation} resolveOnly open={dialog === 'resolve'} onOpenChange={(v) => setDialog(v ? 'resolve' : null)} />
    </div>
  )
}
