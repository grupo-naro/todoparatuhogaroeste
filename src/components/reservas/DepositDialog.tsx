'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { addDeposit } from '@/server/actions/reservations'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from '@/lib/constants'

export function DepositDialog({ reservationId, open, onOpenChange }: {
  reservationId: string
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
    const res = await addDeposit({ reservationId, amount: Number(amount.replace(',', '.')), paymentMethod: method })
    setPending(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    toast('Seña registrada', 'success')
    setAmount('')
    onOpenChange(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Registrar seña">
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm">Monto de la seña</span>
          <Input aria-label="Monto de la seña" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm">Método de pago</span>
          <Select aria-label="Método de pago de la seña" value={method} onValueChange={setMethod}
            options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))} />
        </label>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button onClick={save} loading={pending} disabled={!amount.trim()}>Guardar seña</Button>
      </div>
    </Dialog>
  )
}
