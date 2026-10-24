import type { SaleDetail } from '@/server/queries/sales'
import { formatDate } from '@/lib/format'
import { PAYMENT_METHOD_LABELS } from '@/lib/constants'
import { DocumentSheet } from './DocumentSheet'

export type SaleDocumentData = Omit<SaleDetail, 'createdAt' | 'cancelledAt'> & {
  createdAt: Date | string
  cancelledAt: Date | string | null
}

export function SaleDocument({ sale }: { sale: SaleDocumentData }) {
  return (
    <DocumentSheet
      title="Venta"
      ticketNumber={sale.number}
      date={sale.createdAt}
      address={sale.shippingAddress}
      sellerName={sale.userName}
      lines={sale.items.map((i) => ({
        description: `${i.productName} · ${i.variantName}`, quantity: i.quantity, unitPrice: i.unitPrice, subtotal: i.subtotal,
      }))}
      total={sale.total}
      totalLabel="Total"
      extra={<p className="font-semibold">Método de pago: {PAYMENT_METHOD_LABELS[sale.paymentMethod]}</p>}
      legend={sale.cancelledAt && (
        <p className="text-danger font-medium">
          Venta anulada el {formatDate(sale.cancelledAt)}{sale.cancelledByName ? ` por ${sale.cancelledByName}` : ''}
        </p>
      )}
    />
  )
}
