'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/cn'
import type { NavItem } from './navItems'

export function NavLink({ item, onNavigate, badge }: { item: NavItem; onNavigate?: () => void; badge?: number }) {
  const pathname = usePathname()
  const { href, label, icon: Icon } = item
  const active = pathname === href || pathname.startsWith(href + '/')
  return (
    <Link href={href} aria-current={active ? 'page' : undefined} onClick={onNavigate}
      className={cn('flex items-center gap-3 rounded px-3 py-3 text-sm min-h-11',
        active ? 'bg-accent-soft text-foreground font-medium' : 'hover:bg-border/50 active:bg-border/70 transition-colors')}>
      <Icon size={18} /> {label}
      {badge ? <span aria-label={`${badge} pendientes`} className="ml-auto rounded-full bg-danger text-white text-xs px-2 py-0.5">{badge}</span> : null}
    </Link>
  )
}
