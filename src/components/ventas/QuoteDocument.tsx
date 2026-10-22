import Image from 'next/image'
import { money, integer, formatDate } from '@/lib/format'

export type QuoteDocumentData = {
  lines: { productName: string; variantName: string; unitPrice: number | null; quantity: number }[]
  total: number
  customerName: string | null
  issuedAt: Date | string
}

export function QuoteDocument({ quote }: { quote: QuoteDocumentData }) {
  return (
    <div className="border border-border rounded-lg p-4 print:border-0 print:p-0">
      <div className="flex items-center gap-3 mb-3">
        <Image src="/logo.png" alt="" width={40} height={40} className="rounded-full" />
        <div>
          <p className="font-semibold">Jael Castillo — Todo para tu Hogar</p>
          <p className="text-xs text-muted">Presupuesto · {formatDate(quote.issuedAt)}</p>
        </div>
      </div>
      {quote.customerName && <p className="text-sm mb-3">Presupuesto para: <strong>{quote.customerName}</strong></p>}

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
          {quote.lines.map((line, i) => (
            <tr key={i} className="border-b border-border">
              <td className="py-1">{line.productName} · {line.variantName}</td>
              <td className="py-1 text-right">{integer(line.quantity)}</td>
              <td className="py-1 text-right">{money(line.unitPrice)}</td>
              <td className="py-1 text-right">{money((line.unitPrice ?? 0) * line.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="text-right font-semibold mt-2">Total: {money(quote.total)}</p>

      <p className="text-xs text-muted mt-4 text-center">
        Presupuesto sin cargo. Precios y stock sujetos a confirmación al momento de la compra.
      </p>
    </div>
  )
}
