'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { addDeposit, addRefund } from '@/server/actions/reservations'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from '@/lib/constants'

export function DepositDialog({ reservationId, open, onOpenChange, kind = 'SENA' }: {
  reservationId: string
  kind?: 'SENA' | 'DEVOLUCION'
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('EFECTIVO')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function save() {
    setError(null)
    setPending(true)
    const input = { reservationId, amount: Number(amount.replace(',', '.')), paymentMethod: method }
    const res = kind === 'SENA' ? await addDeposit(input) : await addRefund(input)
    setPending(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    toast(kind === 'SENA' ? 'Seña registrada' : 'Devolución registrada', 'success')
    setAmount('')
    onOpenChange(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={kind === 'SENA' ? 'Registrar seña' : 'Devolver parte de la seña'}>
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm">{kind === 'SENA' ? 'Monto de la seña' : 'Monto'}</span>
          <Input aria-label={kind === 'SENA' ? 'Monto de la seña' : 'Monto'} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm">Método de pago</span>
          <Select aria-label={kind === 'SENA' ? 'Método de pago de la seña' : 'Método de la devolución'} value={method} onValueChange={setMethod}
            options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))} />
        </label>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button onClick={save} loading={pending} disabled={!amount.trim()}>{kind === 'SENA' ? 'Guardar seña' : 'Guardar devolución'}</Button>
      </div>
    </Dialog>
  )
}
