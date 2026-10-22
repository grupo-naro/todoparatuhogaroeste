import Image from 'next/image'
import type { SaleDetail } from '@/server/queries/sales'
import { money, integer, formatDate } from '@/lib/format'
import { PAYMENT_METHOD_LABELS } from '@/lib/constants'

export type SaleDocumentData = Omit<SaleDetail, 'createdAt' | 'cancelledAt'> & {
  createdAt: Date | string
  cancelledAt: Date | string | null
}

export function SaleDocument({ sale }: { sale: SaleDocumentData }) {
  return (
    <div className="border border-border rounded-lg p-4 print:border-0 print:p-0">
      <div className="flex items-center gap-3 mb-3">
        <Image src="/logo.png" alt="" width={40} height={40} loading="eager" className="rounded-full" />
        <div>
          <p className="font-semibold">Jael Castillo — Todo para tu Hogar</p>
          <p className="text-xs text-muted">Ticket N° {sale.number} · {formatDate(sale.createdAt)}</p>
        </div>
      </div>
      <p className="text-sm mb-3">Vendedora: {sale.userName}</p>

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
          {sale.items.map((item) => (
            <tr key={item.variantId} className="border-b border-border">
              <td className="py-1">{item.productName} · {item.variantName}</td>
              <td className="py-1 text-right">{integer(item.quantity)}</td>
              <td className="py-1 text-right">{money(item.unitPrice)}</td>
              <td className="py-1 text-right">{money(item.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="text-right font-semibold mt-2">Total: {money(sale.total)}</p>
      <p className="text-sm mt-1">Método de pago: {PAYMENT_METHOD_LABELS[sale.paymentMethod]}</p>

      {sale.cancelledAt && (
        <p className="text-danger font-medium mt-3">
          Venta anulada el {formatDate(sale.cancelledAt)}{sale.cancelledByName ? ` por ${sale.cancelledByName}` : ''}
        </p>
      )}

      <p className="text-xs text-muted mt-4 text-center">Documento no válido como factura.</p>
    </div>
  )
}
