'use client'
import type { SaleDetail } from '@/server/queries/sales'
import { CancelSaleButton } from './CancelSaleButton'
import { SaleDocument } from './SaleDocument'

export function SaleReceipt({ sale }: { sale: SaleDetail }) {
  return (
    <section className="max-w-lg mx-auto print:max-w-none">
      <div className="flex items-center justify-between mb-4 print:hidden">
        <h1 className="text-xl font-semibold">Ticket N° {sale.number}</h1>
        <div className="flex gap-2">
          <button type="button" onClick={() => window.print()}
            className="min-h-11 px-3 rounded border border-border text-sm">Imprimir</button>
          {!sale.cancelledAt && <CancelSaleButton saleId={sale.id} />}
        </div>
      </div>
      <SaleDocument sale={sale} />
    </section>
  )
}
