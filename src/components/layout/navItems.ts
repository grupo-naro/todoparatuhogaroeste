import { Boxes, ClipboardList, Package, Tags, Users, type LucideIcon } from 'lucide-react'
import type { RoleName } from '@/lib/constants'

export type NavItem = { href: string; label: string; icon: LucideIcon; adminOnly?: boolean }

const ALL: NavItem[] = [
  { href: '/deposito', label: 'Depósito', icon: Boxes },
  { href: '/carga-inicial', label: 'Carga inicial', icon: ClipboardList },
  { href: '/productos', label: 'Productos', icon: Package },
  { href: '/categorias', label: 'Categorías', icon: Tags },
  { href: '/usuarios', label: 'Usuarios', icon: Users, adminOnly: true },
]

export function navItemsFor(role: RoleName): NavItem[] {
  return ALL.filter((i) => !i.adminOnly || role === 'ADMIN')
}
