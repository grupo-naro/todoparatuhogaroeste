import { DocumentSheet } from './DocumentSheet'

export type QuoteDocumentData = {
  lines: { productName: string; variantName: string; unitPrice: number | null; quantity: number }[]
  total: number
  customerName: string | null
  shippingAddress?: string | null
  issuedAt: Date | string
}

export function QuoteDocument({ quote }: { quote: QuoteDocumentData }) {
  return (
    <DocumentSheet
      title="Presupuesto"
      date={quote.issuedAt}
      customerName={quote.customerName}
      address={quote.shippingAddress}
      lines={quote.lines.map((l) => ({
        description: `${l.productName} · ${l.variantName}`, quantity: l.quantity, unitPrice: l.unitPrice,
        subtotal: (l.unitPrice ?? 0) * l.quantity,
      }))}
      total={quote.total}
      totalLabel="Precio de lista"
      legend={<p className="text-xs text-muted text-center print:text-[9pt]">Presupuesto sin cargo. Precios y stock sujetos a confirmación al momento de la compra.</p>}
    />
  )
}
