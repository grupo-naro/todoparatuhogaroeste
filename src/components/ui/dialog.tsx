'use client'
import * as D from '@radix-ui/react-dialog'
import { X } from 'lucide-react'

export function Dialog({
  open, onOpenChange, title, children,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; title: string; children: React.ReactNode
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <D.Content
          aria-describedby={undefined}
          className="fixed z-50 bg-card border border-border p-4 shadow-lg
                     inset-x-0 bottom-0 rounded-t-xl max-h-[90vh] overflow-auto
                     sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2
                     sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md sm:rounded-xl"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <div className="flex items-center justify-between mb-3">
            <D.Title className="font-semibold">{title}</D.Title>
            <D.Close aria-label="Cerrar" className="p-2 -mr-2 min-h-11 min-w-11"><X size={18} /></D.Close>
          </div>
          {children}
        </D.Content>
      </D.Portal>
    </D.Root>
  )
}
