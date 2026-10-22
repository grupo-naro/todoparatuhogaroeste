import { BUSINESS } from '@/lib/business'

export function ContactFooter() {
  return (
    <footer className="mt-auto pt-6">
      <div className="border-t border-border pt-3 text-xs print:text-[10pt] space-y-1">
        <p>Instagram: @{BUSINESS.instagram}</p>
        <ul className="space-y-0.5">
          {BUSINESS.contacts.map((c) => (
            <li key={c.name}>{c.name}: {c.phone} ({c.kind})</li>
          ))}
        </ul>
      </div>
    </footer>
  )
}
