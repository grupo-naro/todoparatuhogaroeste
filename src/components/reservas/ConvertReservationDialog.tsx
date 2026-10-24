'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { convertReservation } from '@/server/actions/reservations'
import type { ReservationDetail } from '@/server/queries/reservations'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from '@/lib/constants'
import { money } from '@/lib/format'

type PriceMode = 'RESERVA' | 'ACTUAL'

export function ConvertReservationDialog({ reservation, open, onOpenChange }: {
  reservation: ReservationDetail
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const router = useRouter()
  const [method, setMethod] = useState('EFECTIVO')
  const [priceMode, setPriceMode] = useState<PriceMode | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const changed = reservation.items.filter((i) => i.currentPrice !== i.unitPrice)
  const needsPriceChoice = changed.length > 0 && priceMode === null
  const priceOf = (i: (typeof reservation.items)[number]) => (priceMode === 'ACTUAL' ? i.currentPrice ?? i.unitPrice : i.unitPrice)
  const total = reservation.items.reduce((s, i) => s + priceOf(i) * i.quantity, 0) - reservation.discount

  async function confirm() {
    setError(null)
    setPending(true)
    const res = await convertReservation({
      id: reservation.id, paymentMethod: method, ...(priceMode ? { priceMode } : {}),
    })
    setPending(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    onOpenChange(false)
    router.push(`/ventas/${res.saleId}`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Concretar venta">
      <div className="flex flex-col gap-4">
        {changed.length > 0 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm mb-1">Cambiaron los precios desde que se hizo la reserva:</legend>
            <ul className="text-sm space-y-1">
              {changed.map((i) => (
                <li key={i.variantId}>
                  {i.productName} · {i.variantName}: reservado a {money(i.unitPrice)}, hoy {money(i.currentPrice)}
                </li>
              ))}
            </ul>
            <label className="flex items-center gap-3 min-h-11 border border-border rounded px-3">
              <input type="radio" name="price-mode" checked={priceMode === 'RESERVA'} onChange={() => setPriceMode('RESERVA')} />
              <span>Cobrar el precio de la reserva</span>
            </label>
            <label className="flex items-center gap-3 min-h-11 border border-border rounded px-3">
              <input type="radio" name="price-mode" checked={priceMode === 'ACTUAL'} onChange={() => setPriceMode('ACTUAL')} />
              <span>Cobrar el precio actual</span>
            </label>
          </fieldset>
        )}
        {!needsPriceChoice && (
          <dl className="grid grid-cols-2 gap-y-1 text-sm">
            <dt className="text-muted">Total</dt><dd className="text-right">{money(total)}</dd>
            <dt className="text-muted">Seña cobrada</dt><dd className="text-right">{money(reservation.depositBalance)}</dd>
            <dt className="font-medium">A cobrar ahora</dt><dd className="text-right font-medium">{money(total - reservation.depositBalance)}</dd>
          </dl>
        )}
        <label className="flex flex-col gap-1">
          <span className="text-sm">Método de pago</span>
          <Select aria-label="Método de pago" value={method} onValueChange={setMethod}
            options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))} />
        </label>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button onClick={confirm} loading={pending} disabled={needsPriceChoice}>Confirmar venta</Button>
      </div>
    </Dialog>
  )
}
