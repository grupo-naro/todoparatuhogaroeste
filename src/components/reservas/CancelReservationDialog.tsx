'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cancelReservation, resolveDeposit } from '@/server/actions/reservations'
import type { ReservationDetail } from '@/server/queries/reservations'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { DepositDecisionFields, toDecision, type DepositChoice } from './DepositDecisionFields'

// Sirve para dos casos: cancelar una reserva abierta, o resolver la seña de una ya cerrada (vencida).
export function CancelReservationDialog({ reservation, open, onOpenChange, resolveOnly = false }: {
  reservation: ReservationDetail
  open: boolean
  onOpenChange: (v: boolean) => void
  resolveOnly?: boolean
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [choice, setChoice] = useState<DepositChoice>(null)
  const [method, setMethod] = useState('EFECTIVO')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const hasDeposit = reservation.depositBalance > 0
  const needsChoice = hasDeposit && choice === null

  async function confirm() {
    setError(null)
    setPending(true)
    const deposit = toDecision(choice, method)
    const res = resolveOnly
      ? await resolveDeposit({ id: reservation.id, deposit })
      : await cancelReservation({ id: reservation.id, ...(hasDeposit && deposit ? { deposit } : {}) })
    setPending(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    toast(resolveOnly ? 'Seña resuelta' : 'Reserva cancelada', 'success')
    onOpenChange(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={resolveOnly ? 'Resolver seña' : 'Cancelar reserva'}>
      <div className="flex flex-col gap-4">
        {!resolveOnly && (
          <p className="text-sm">
            Se libera lo apartado de la reserva N° {reservation.number} y vuelve a estar disponible para vender.
          </p>
        )}
        {hasDeposit && (
          <DepositDecisionFields balance={reservation.depositBalance} choice={choice} onChoice={setChoice}
            method={method} onMethod={setMethod} />
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button variant={resolveOnly ? 'primary' : 'danger'} onClick={confirm} loading={pending} disabled={needsChoice}>
          {resolveOnly ? 'Confirmar' : 'Sí, cancelar reserva'}
        </Button>
      </div>
    </Dialog>
  )
}
