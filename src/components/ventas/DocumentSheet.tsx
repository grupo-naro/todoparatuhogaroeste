import type { ReactNode } from 'react'
import Image from 'next/image'
import { money, integer, formatDate } from '@/lib/format'
import { BUSINESS } from '@/lib/business'
import { ContactFooter } from './ContactFooter'

export type DocumentLine = { description: string; quantity: number; unitPrice: number | null; subtotal: number }

// Filas mínimas del cuadro de detalle: el papel impreso siempre tiene renglones de sobra.
const MIN_ROWS = 11
const LINE = 'border-[#8a9078]'

function Band({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="doc-band flex items-center justify-between px-3 py-1 font-semibold uppercase tracking-wide print:py-1.5">
      <span>{children}</span>
      {right && <span>{right}</span>}
    </div>
  )
}

function Field({ label, children }: { label: string; children?: ReactNode }) {
  return (
    <p className={`flex gap-2 border-b ${LINE} px-3 py-1.5 print:py-2`}>
      <span className="text-muted shrink-0">{label}</span>
      <span className="font-medium">{children}</span>
    </p>
  )
}

function Blank({ label }: { label: string }) {
  return (
    <p className="flex items-end gap-1 font-semibold uppercase">
      <span className="shrink-0">{label}</span>
      <span className="flex-1 border-b border-foreground min-w-8" />
    </p>
  )
}

export function DocumentSheet({
  title, ticketNumber, date, customerName, address, sellerName, lines, total, totalLabel, extra, legend,
}: {
  title: string
  ticketNumber?: number
  date: Date | string
  customerName?: string | null
  address?: string | null
  sellerName?: string
  lines: DocumentLine[]
  total: number
  totalLabel: string
  extra?: ReactNode
  legend?: ReactNode
}) {
  const blankRows = Math.max(0, MIN_ROWS - lines.length)
  return (
    <div className="a4-sheet flex flex-col gap-3 border border-border rounded-lg p-4 text-sm print:gap-3 print:border-0 print:rounded-none print:p-[10mm] print:w-full print:min-h-[296mm] print:text-[11pt] print:[box-decoration-break:clone]">
      <header className="text-center">
        <p className="font-semibold text-muted print:text-[11pt]">{BUSINESS.address}</p>
        <div className="flex items-center justify-between gap-3">
          <Image src="/logo.png" alt="" width={80} height={80} loading="eager" className="rounded-full size-12 print:size-20" />
          <div>
            <p className="text-3xl font-semibold tracking-wide uppercase print:text-5xl">{title}</p>
            {ticketNumber !== undefined && <p className="font-semibold print:text-lg">Ticket N° {ticketNumber}</p>}
            <p className="text-muted print:text-[11pt]">Documento no válido como factura</p>
          </div>
          <Image src="/logo.png" alt="" width={80} height={80} loading="eager" className="rounded-full size-12 print:size-20" />
        </div>
      </header>

      <div className="flex items-start justify-between gap-4">
        <div className="doc-band px-3 py-1 font-semibold space-y-1 print:space-y-2 print:py-2">
          <p>Fecha de pedido: {formatDate(date)}</p>
          <p>Fecha de entrega:</p>
        </div>
        <div className="text-right">
          <p className="uppercase text-muted">Mercado Pago</p>
          <p className="text-muted">Alias: {BUSINESS.mercadoPago.alias}</p>
          <p className="font-semibold">{BUSINESS.mercadoPago.holder}</p>
        </div>
      </div>

      <section>
        <Band>Información del cliente:</Band>
        <Field label="Nombre y apellido:">{customerName}</Field>
        <div className="grid grid-cols-[3fr_2fr]">
          <Field label="Dirección:">{address}</Field>
          <Field label="Localidad:" />
        </div>
        <Field label="Teléfono:" />
        {sellerName && <Field label="Vendedora:">{sellerName}</Field>}
      </section>

      <section className="flex-1 flex flex-col">
        <Band right="Total">Detalle</Band>
        <div className={`border ${LINE} flex flex-1 flex-col`}>
          {lines.map((line, i) => (
            <div key={i} className={`grid grid-cols-[1fr_9rem] border-b ${LINE} break-inside-avoid min-h-9 print:min-h-[8.5mm]`}>
              <p className="px-3 py-1.5 print:py-2">
                {integer(line.quantity)} × {line.description}
                {line.unitPrice !== null && line.quantity > 1 && (
                  <span className="text-muted text-xs print:text-[9pt]"> ({money(line.unitPrice)} c/u)</span>
                )}
              </p>
              <p className={`px-3 py-1.5 print:py-2 text-right border-l ${LINE}`}>{money(line.subtotal)}</p>
            </div>
          ))}
          {Array.from({ length: blankRows }, (_, i) => (
            <div key={`b${i}`} aria-hidden className={`grid grid-cols-[1fr_9rem] border-b ${LINE} last:flex-1 last:border-b-0 min-h-9 print:min-h-[8.5mm]`}>
              <span />
              <span className={`border-l ${LINE}`} />
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-x-6 gap-y-3 print:gap-y-4">
        <Blank label="Seña:" />
        <p className="flex items-end gap-1 font-semibold uppercase">
          <span className="shrink-0">{totalLabel}:</span>
          <span className="flex-1 border-b border-foreground min-w-8 text-right normal-case">{money(total)}</span>
        </p>
        <Blank label="Envío:" />
        <Blank label="Dto en efectivo:" />
      </div>

      {extra}
      {legend}

      <ContactFooter />
    </div>
  )
}
