import Link from 'next/link'
import { cn } from '@/lib/cn'
import type { ReservationTab } from '@/server/queries/reservations'

const TABS: { tab: ReservationTab; label: string }[] = [
  { tab: 'esperando', label: 'Esperando' },
  { tab: 'listas', label: 'Listas' },
  { tab: 'cerradas', label: 'Cerradas' },
]

export function ReservationTabs({ tab, readyCount }: { tab: ReservationTab; readyCount?: number }) {
  return (
    <nav className="flex gap-2 mb-4 overflow-x-auto" aria-label="Estado de las reservas">
      {TABS.map((t) => (
        <Link key={t.tab} href={`/reservas?tab=${t.tab}`} aria-current={t.tab === tab ? 'page' : undefined}
          className={cn('inline-flex items-center gap-2 px-4 min-h-11 rounded text-sm font-medium whitespace-nowrap',
            t.tab === tab ? 'bg-primary text-primary-foreground' : 'border border-border')}>
          {t.label}
          {t.tab === 'listas' && readyCount ? <span aria-label={`${readyCount} listas`} className="rounded-full bg-danger text-white text-xs px-2">{readyCount}</span> : null}
        </Link>
      ))}
    </nav>
  )
}
