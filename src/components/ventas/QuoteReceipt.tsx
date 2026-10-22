'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { QuoteDocument } from './QuoteDocument'

export type QuoteLine = {
  variantId: string; productName: string; variantName: string
  unitPrice: number | null; quantity: string
}

export function QuoteReceipt({ lines, total, customerName, shippingAddress, onNuevoPresupuesto }: {
  lines: QuoteLine[]; total: number; customerName?: string; shippingAddress?: string; onNuevoPresupuesto: () => void
}) {
  const [date] = useState(() => new Date())

  return (
    <section className="max-w-lg mx-auto print:max-w-none">
      <div className="flex items-center justify-between mb-4 print:hidden">
        <h1 className="text-xl font-semibold">Presupuesto</h1>
        <div className="flex gap-2">
          <button type="button" onClick={() => window.print()}
            className="min-h-11 px-3 rounded border border-border text-sm">Imprimir</button>
          <Button onClick={onNuevoPresupuesto}>Nuevo presupuesto</Button>
        </div>
      </div>
      <QuoteDocument quote={{
        lines: lines.map((l) => ({
          productName: l.productName, variantName: l.variantName,
          unitPrice: l.unitPrice, quantity: Number(l.quantity) || 0,
        })),
        total,
        customerName: customerName ?? null,
        shippingAddress: shippingAddress ?? null,
        issuedAt: date,
      }} />
    </section>
  )
}
