'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cancelSale } from '@/server/actions/sales'
import { useToast } from '@/components/ui/toast'

export function CancelSaleButton({ saleId }: { saleId: string }) {
  const router = useRouter()
  const { toast } = useToast()
  const [pending, setPending] = useState(false)

  async function handleCancel() {
    if (!window.confirm('¿Seguro que querés anular esta venta? Repone el stock vendido.')) return
    setPending(true)
    const res = await cancelSale(saleId)
    setPending(false)
    if (!res.ok) {
      toast(res.error, 'danger')
      return
    }
    toast('Venta anulada', 'success')
    router.refresh()
  }

  return (
    <button type="button" onClick={handleCancel} disabled={pending}
      className="min-h-11 px-3 rounded border border-danger text-danger text-sm disabled:opacity-60">
      {pending ? 'Anulando…' : 'Anular venta'}
    </button>
  )
}
