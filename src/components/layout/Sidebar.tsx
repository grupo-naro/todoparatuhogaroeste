'use client'
import type { RoleName } from '@/lib/constants'
import { navItemsFor } from './navItems'
import { NavLink } from './NavLink'

export function Sidebar({ role }: { role: RoleName }) {
  return (
    <nav className="hidden md:flex flex-col w-56 shrink-0 border-r border-border p-3 gap-1">
      {navItemsFor(role).map((item) => <NavLink key={item.href} item={item} />)}
    </nav>
  )
}
