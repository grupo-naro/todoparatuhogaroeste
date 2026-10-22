import Image from 'next/image'
import type { SaleDetail } from '@/server/queries/sales'
import { money, integer, formatDate } from '@/lib/format'
import { PAYMENT_METHOD_LABELS } from '@/lib/constants'
import { BUSINESS } from '@/lib/business'
import { ContactFooter } from './ContactFooter'

export type SaleDocumentData = Omit<SaleDetail, 'createdAt' | 'cancelledAt'> & {
  createdAt: Date | string
  cancelledAt: Date | string | null
}

export function SaleDocument({ sale }: { sale: SaleDocumentData }) {
  return (
    <div className="a4-sheet flex flex-col border border-border rounded-lg p-4 print:border-0 print:rounded-none print:p-[15mm] print:w-full print:min-h-[296mm] print:text-[11pt] print:[box-decoration-break:clone]">
      <div className="flex items-start justify-between gap-4 mb-3 print:mb-8">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="" width={40} height={40} loading="eager" className="rounded-full print:size-16" />
          <p className="font-semibold print:text-lg">{BUSINESS.name}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-semibold print:text-xl">Ticket N° {sale.number}</p>
          <p className="text-xs text-muted print:text-sm">{formatDate(sale.createdAt)}</p>
        </div>
      </div>

      <div className="text-sm mb-3 space-y-1 print:text-[11pt] print:mb-6">
        <p>Vendedora: {sale.userName}</p>
        {sale.shippingAddress && <p>Envío a: <strong>{sale.shippingAddress}</strong></p>}
      </div>

      <table className="w-full text-sm print:text-[11pt]">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="py-1 print:py-2">Producto</th>
            <th className="py-1 print:py-2 text-right">Cant.</th>
            <th className="py-1 print:py-2 text-right">P. unit.</th>
            <th className="py-1 print:py-2 text-right">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {sale.items.map((item) => (
            <tr key={item.variantId} className="border-b border-border break-inside-avoid">
              <td className="py-1 print:py-2">{item.productName} · {item.variantName}</td>
              <td className="py-1 print:py-2 text-right">{integer(item.quantity)}</td>
              <td className="py-1 print:py-2 text-right">{money(item.unitPrice)}</td>
              <td className="py-1 print:py-2 text-right">{money(item.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="text-right font-semibold mt-3 print:text-xl print:mt-6">Total: {money(sale.total)}</p>
      <p className="text-sm mt-1 print:text-[11pt]">Método de pago: {PAYMENT_METHOD_LABELS[sale.paymentMethod]}</p>

      {sale.cancelledAt && (
        <p className="text-danger font-medium mt-3">
          Venta anulada el {formatDate(sale.cancelledAt)}{sale.cancelledByName ? ` por ${sale.cancelledByName}` : ''}
        </p>
      )}

      <p className="text-xs text-muted mt-4 text-center print:text-[9pt]">Documento no válido como factura.</p>

      <ContactFooter />
    </div>
  )
}
