'use client'
import { useEffect } from 'react'
import Image from 'next/image'
import { money, integer } from '@/lib/format'
import { Button } from '@/components/ui/button'

export type QuoteLine = {
  variantId: string; productName: string; variantName: string
  unitPrice: number | null; quantity: string
}

export function QuoteReceipt({ lines, total, customerName, onNuevoPresupuesto }: {
  lines: QuoteLine[]; total: number; customerName?: string; onNuevoPresupuesto: () => void
}) {
  useEffect(() => {
    window.print()
  }, [])

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

      <div className="border border-border rounded-lg p-4 print:border-0 print:p-0">
        <div className="flex items-center gap-3 mb-3">
          <Image src="/logo.png" alt="" width={40} height={40} className="rounded-full" />
          <div>
            <p className="font-semibold">Jael Castillo — Todo para tu Hogar</p>
            <p className="text-xs text-muted">Presupuesto</p>
          </div>
        </div>
        {customerName && <p className="text-sm mb-3">Presupuesto para: <strong>{customerName}</strong></p>}

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="py-1">Producto</th>
              <th className="py-1 text-right">Cant.</th>
              <th className="py-1 text-right">P. unit.</th>
              <th className="py-1 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.variantId} className="border-b border-border">
                <td className="py-1">{line.productName} · {line.variantName}</td>
                <td className="py-1 text-right">{integer(Number(line.quantity) || 0)}</td>
                <td className="py-1 text-right">{money(line.unitPrice)}</td>
                <td className="py-1 text-right">{money((line.unitPrice ?? 0) * (Number(line.quantity) || 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="text-right font-semibold mt-2">Total: {money(total)}</p>

        <p className="text-xs text-muted mt-4 text-center">
          Presupuesto sin cargo. Precios y stock sujetos a confirmación al momento de la compra.
        </p>
      </div>
    </section>
  )
}
