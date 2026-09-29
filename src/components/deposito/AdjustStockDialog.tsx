'use client'
import { useState } from 'react'
import { Plus, Minus, Pencil, type LucideIcon } from 'lucide-react'
import { adjustStock } from '@/server/actions/inventory'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { QuantityStepper } from '@/components/grid/QuantityStepper'
import { cn } from '@/lib/cn'

type Action = 'add' | 'remove' | 'set'

const ACTIONS: { value: Action; label: string; hint: string; icon: LucideIcon }[] = [
  { value: 'add', label: 'Agregar unidades', hint: 'Llegó mercadería nueva', icon: Plus },
  { value: 'remove', label: 'Quitar unidades', hint: 'Se rompió, se perdió o salió del sistema', icon: Minus },
  { value: 'set', label: 'Corregir el total', hint: 'El número actual está mal', icon: Pencil },
]

export function AdjustStockDialog({
  variantId, label, currentQuantity, className,
}: { variantId: string; label: string; currentQuantity: number; className?: string }) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [action, setAction] = useState<Action>('add')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  function openDialog() {
    setAction('add')
    setAmount('')
    setNote('')
    setError(null)
    setOpen(true)
  }

  function selectAction(next: Action) {
    setAction(next)
    setAmount(next === 'set' ? String(currentQuantity) : '')
    setError(null)
  }

  async function handleSave() {
    setPending(true)
    const payload = action === 'set'
      ? { variantId, mode: 'set' as const, quantity: Number(amount), note }
      : { variantId, mode: 'delta' as const, delta: (action === 'remove' ? -1 : 1) * Number(amount), note }
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
          <div className="flex flex-col gap-2">
            {ACTIONS.map(({ value, label: actionLabel, hint, icon: Icon }) => (
              <button key={value} type="button" aria-pressed={action === value} aria-label={actionLabel}
                onClick={() => selectAction(value)}
                className={cn(
                  'flex items-center gap-3 rounded border p-2 text-left min-h-11',
                  action === value ? 'border-primary bg-primary/10' : 'border-border',
                )}>
                <Icon size={18} className="shrink-0" aria-hidden="true" />
                <span>
                  <span className="block text-sm font-medium">{actionLabel}</span>
                  <span className="block text-xs text-muted">{hint}</span>
                </span>
              </button>
            ))}
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-sm">{action === 'set' ? 'Nueva cantidad' : 'Cantidad'}</span>
            {action === 'set' ? (
              <Input aria-label="Nueva cantidad" inputMode="numeric" value={amount}
                onChange={(e) => setAmount(e.target.value)} />
            ) : (
              <QuantityStepper value={amount} onChange={setAmount} ariaLabel="Cantidad (ajuste)" />
            )}
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm">Motivo</span>
            <Input aria-label="Motivo" value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button onClick={handleSave} loading={pending}>Guardar ajuste</Button>
        </div>
      </Dialog>
    </>
  )
}
