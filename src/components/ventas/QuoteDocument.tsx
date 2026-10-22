import Image from 'next/image'
import { money, integer, formatDate } from '@/lib/format'
import { BUSINESS } from '@/lib/business'
import { ContactFooter } from './ContactFooter'

export type QuoteDocumentData = {
  lines: { productName: string; variantName: string; unitPrice: number | null; quantity: number }[]
  total: number
  customerName: string | null
  shippingAddress?: string | null
  issuedAt: Date | string
}

export function QuoteDocument({ quote }: { quote: QuoteDocumentData }) {
  return (
    <div className="a4-sheet flex flex-col border border-border rounded-lg p-4 print:border-0 print:rounded-none print:p-[15mm] print:w-full print:min-h-[296mm] print:text-[11pt] print:[box-decoration-break:clone]">
      <div className="flex items-start justify-between gap-4 mb-3 print:mb-8">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="" width={40} height={40} loading="eager" className="rounded-full print:size-16" />
          <p className="font-semibold print:text-lg">{BUSINESS.name}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-semibold print:text-xl">Presupuesto</p>
          <p className="text-xs text-muted print:text-sm">{formatDate(quote.issuedAt)}</p>
        </div>
      </div>

      <div className="text-sm mb-3 space-y-1 print:text-[11pt] print:mb-6">
        {quote.customerName && <p>Presupuesto para: <strong>{quote.customerName}</strong></p>}
        {quote.shippingAddress && <p>Envío a: <strong>{quote.shippingAddress}</strong></p>}
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
          {quote.lines.map((line, i) => (
            <tr key={i} className="border-b border-border break-inside-avoid">
              <td className="py-1 print:py-2">{line.productName} · {line.variantName}</td>
              <td className="py-1 print:py-2 text-right">{integer(line.quantity)}</td>
              <td className="py-1 print:py-2 text-right">{money(line.unitPrice)}</td>
              <td className="py-1 print:py-2 text-right">{money((line.unitPrice ?? 0) * line.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="text-right font-semibold mt-3 print:text-xl print:mt-6">Total: {money(quote.total)}</p>

      <p className="text-xs text-muted mt-4 text-center print:text-[9pt]">
        Presupuesto sin cargo. Precios y stock sujetos a confirmación al momento de la compra.
      </p>

      <ContactFooter />
    </div>
  )
}
