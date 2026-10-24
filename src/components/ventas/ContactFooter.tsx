import { BUSINESS } from '@/lib/business'

export function ContactFooter() {
  return (
    <footer className="doc-band mt-auto px-3 py-2 text-center text-xs print:text-[10pt] space-y-0.5">
      <p>{BUSINESS.phones.minorista.join(' • ')} Venta Minorista</p>
      <p>{BUSINESS.phones.mayorista.join(' • ')} Venta Mayorista</p>
      <p>Instagram: @{BUSINESS.instagram}</p>
    </footer>
  )
}
