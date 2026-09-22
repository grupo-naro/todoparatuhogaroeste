'use client'
import { useState } from 'react'
import { adjustStock } from '@/server/actions/inventory'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { QuantityStepper } from '@/components/grid/QuantityStepper'
import { cn } from '@/lib/cn'

type Mode = 'delta' | 'set'
type Sign = '+' | '-'

function ToggleButton({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={pressed} onClick={onClick}
      className={cn(
        'flex-1 min-h-11 rounded border text-sm',
        pressed ? 'border-primary bg-primary/10 font-medium' : 'border-border',
      )}>
      {children}
    </button>
  )
}

export function AdjustStockDialog({
  variantId, label, currentQuantity, className,
}: { variantId: string; label: string; currentQuantity: number; className?: string }) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('delta')
  const [sign, setSign] = useState<Sign>('+')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  function openDialog() {
    setMode('delta')
    setSign('+')
    setAmount('')
    setNote('')
    setError(null)
    setOpen(true)
  }

  function switchMode(next: Mode) {
    setMode(next)
    setAmount(next === 'set' ? String(currentQuantity) : '')
    setError(null)
  }

  async function handleSave() {
    setPending(true)
    const payload = mode === 'set'
      ? { variantId, mode: 'set' as const, quantity: Number(amount), note }
      : { variantId, mode: 'delta' as const, delta: (sign === '-' ? -1 : 1) * Number(amount), note }
    const res = await adjustStock(payload)
    setPending(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setOpen(false)
    toast('Stock ajustado', 'success')
  }

  return (
    <>
      <Button size="sm" className={className} onClick={openDialog}>Ajustar</Button>
      <Dialog open={open} onOpenChange={setOpen} title={`Ajustar stock: ${label}`}>
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <ToggleButton pressed={mode === 'delta'} onClick={() => switchMode('delta')}>Sumar/restar</ToggleButton>
            <ToggleButton pressed={mode === 'set'} onClick={() => switchMode('set')}>Corregir total</ToggleButton>
          </div>

          {mode === 'delta' ? (
            <>
              <div className="flex gap-2">
                <ToggleButton pressed={sign === '+'} onClick={() => setSign('+')}>Entrada (+)</ToggleButton>
                <ToggleButton pressed={sign === '-'} onClick={() => setSign('-')}>Salida (-)</ToggleButton>
              </div>
              <label className="flex flex-col gap-1">
                <span className="text-sm">Cantidad</span>
                <QuantityStepper value={amount} onChange={setAmount} ariaLabel="Cantidad (ajuste)" />
              </label>
            </>
          ) : (
            <label className="flex flex-col gap-1">
              <span className="text-sm">Nueva cantidad</span>
              <Input aria-label="Nueva cantidad" inputMode="numeric" value={amount}
                onChange={(e) => setAmount(e.target.value)} />
            </label>
          )}

          <label className="flex flex-col gap-1">
            <span className="text-sm">Motivo</span>
            <Input aria-label="Motivo" value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button onClick={handleSave} disabled={pending}>Guardar ajuste</Button>
        </div>
      </Dialog>
    </>
  )
}
