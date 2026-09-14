import { Package, Tags, Users, type LucideIcon } from 'lucide-react'
import type { RoleName } from '@/lib/constants'

export type NavItem = { href: string; label: string; icon: LucideIcon; adminOnly?: boolean }

// Agregá acá cada página nueva a medida que se construye — esta lista maneja
// tanto el Sidebar de escritorio como el NavDrawer mobile.
const ALL: NavItem[] = [
  { href: '/productos', label: 'Productos', icon: Package },
  { href: '/categorias', label: 'Categorías', icon: Tags },
  { href: '/usuarios', label: 'Usuarios', icon: Users, adminOnly: true },
]

export function navItemsFor(role: RoleName): NavItem[] {
  return ALL.filter((i) => !i.adminOnly || role === 'ADMIN')
}
