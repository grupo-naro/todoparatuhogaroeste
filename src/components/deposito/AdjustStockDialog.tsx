'use client'
import { useState } from 'react'
import { adjustStock } from '@/server/actions/inventory'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'

export function AdjustStockDialog({
  variantId, label, currentQuantity, className,
}: { variantId: string; label: string; currentQuantity: number; className?: string }) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [quantity, setQuantity] = useState(String(currentQuantity))
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  function openDialog() {
    setQuantity(String(currentQuantity))
    setNote('')
    setError(null)
    setOpen(true)
  }

  async function handleSave() {
    setPending(true)
    const res = await adjustStock({ variantId, quantity: Number(quantity), note })
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
          <label className="flex flex-col gap-1">
            <span className="text-sm">Nueva cantidad</span>
            <Input
              aria-label="Nueva cantidad"
              inputMode="numeric"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm">Motivo</span>
            <Input
              aria-label="Motivo"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button onClick={handleSave} disabled={pending}>Guardar ajuste</Button>
        </div>
      </Dialog>
    </>
  )
}
