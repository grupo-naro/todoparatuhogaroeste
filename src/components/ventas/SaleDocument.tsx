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
      customerName={sale.customerName}
      address={sale.shippingAddress}
      city={sale.shippingCity}
      sellerName={sale.userName}
      lines={sale.items.map((i) => ({
        description: `${i.productName} · ${i.variantName}`, quantity: i.quantity, unitPrice: i.unitPrice, subtotal: i.subtotal,
      }))}
      total={sale.total}
      depositAmount={sale.depositApplied > 0 ? sale.depositApplied : undefined}
      balance={sale.depositApplied > 0 ? sale.total - sale.depositApplied : undefined}
      totalLabel="Total"
      discount={sale.discount > 0 ? sale.discount : undefined}
      discountReason={sale.discountReason}
      extra={<p className="font-semibold">Método de pago: {PAYMENT_METHOD_LABELS[sale.paymentMethod]}</p>}
      legend={sale.cancelledAt && (
        <p className="text-danger font-medium">
          Venta anulada el {formatDate(sale.cancelledAt)}{sale.cancelledByName ? ` por ${sale.cancelledByName}` : ''}
        </p>
      )}
    />
  )
}
