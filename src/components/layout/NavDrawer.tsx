'use client'
import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Menu, X } from 'lucide-react'
import type { RoleName } from '@/lib/constants'
import { navItemsFor } from './navItems'
import { NavLink } from './NavLink'

export function NavDrawer({ role }: { role: RoleName }) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger aria-label="Abrir menú" className="lg:hidden p-2 -ml-2 min-h-11 min-w-11">
        <Menu size={22} />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 lg:hidden" />
        <Dialog.Content
          className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-card border-r border-border p-3
                     flex flex-col gap-1 lg:hidden"
          style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="flex items-center justify-between px-1 pb-2">
            <Dialog.Title className="font-semibold">Menú</Dialog.Title>
            <Dialog.Close aria-label="Cerrar menú" className="p-2 min-h-11 min-w-11"><X size={20} /></Dialog.Close>
          </div>
          {navItemsFor(role).map((item) => (
            <NavLink key={item.href} item={item} onNavigate={() => setOpen(false)} />
          ))}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
