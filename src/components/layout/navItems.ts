import { Package, Tags, Users, Warehouse, ShoppingCart, type LucideIcon } from 'lucide-react'
import type { RoleName } from '@/lib/constants'

export type NavItem = { href: string; label: string; icon: LucideIcon; roles?: RoleName[] }

// Agregá acá cada página nueva a medida que se construye — esta lista maneja
// tanto el Sidebar de escritorio como el NavDrawer mobile. Sin `roles`, el
// ítem es visible para cualquier usuario autenticado.
const ALL: NavItem[] = [
  { href: '/productos', label: 'Productos', icon: Package, roles: ['ADMIN', 'DEPOSITO'] },
  { href: '/categorias', label: 'Categorías', icon: Tags, roles: ['ADMIN', 'DEPOSITO'] },
  { href: '/deposito', label: 'Depósito', icon: Warehouse, roles: ['ADMIN', 'DEPOSITO'] },
  { href: '/ventas', label: 'Ventas', icon: ShoppingCart, roles: ['ADMIN', 'VENDEDOR'] },
  { href: '/usuarios', label: 'Usuarios', icon: Users, roles: ['ADMIN'] },
]

export function navItemsFor(role: RoleName): NavItem[] {
  return ALL.filter((i) => !i.roles || i.roles.includes(role))
}
