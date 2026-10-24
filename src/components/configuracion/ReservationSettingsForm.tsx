'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateStoreSettings } from '@/server/actions/settings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'

export function ReservationSettingsForm({ settings }: {
  settings: { reservationExpiryEnabled: boolean; reservationExpiryDays: number }
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [enabled, setEnabled] = useState(settings.reservationExpiryEnabled)
  const [days, setDays] = useState(String(settings.reservationExpiryDays))
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function save() {
    setError(null)
    setPending(true)
    const res = await updateStoreSettings({ reservationExpiryEnabled: enabled, reservationExpiryDays: Number(days) })
    setPending(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    toast('Ajustes guardados', 'success')
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-4 max-w-md">
      <div className="flex items-center justify-between gap-4 border border-border rounded-lg p-3">
        <span id="expiry-label" className="text-sm font-medium">Liberar reservas automáticamente</span>
        <button type="button" role="switch" aria-checked={enabled} aria-labelledby="expiry-label"
          onClick={() => setEnabled((v) => !v)}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors min-h-11 ${enabled ? 'bg-primary' : 'bg-border'}`}>
          <span className={`inline-block size-5 rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-sm">Días</span>
        <Input aria-label="Días" inputMode="numeric" value={days} disabled={!enabled}
          onChange={(e) => setDays(e.target.value)} />
        <span className="text-xs text-muted">
          Una reserva lista que no se concreta se libera pasados estos días, contados desde que la reserva quedó lista
          (llegó todo lo que faltaba). Las reservas que todavía esperan stock no vencen.
        </span>
      </label>
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button onClick={save} loading={pending}>Guardar</Button>
    </div>
  )
}
