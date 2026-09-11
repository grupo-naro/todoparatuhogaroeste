'use client'
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import * as T from '@radix-ui/react-toast'
import { cn } from '@/lib/cn'

type Tone = 'success' | 'danger'
type ToastItem = { id: number; msg: string; tone?: Tone }

type ToastCtx = { toast: (msg: string, tone?: Tone) => void }

const Ctx = createContext<ToastCtx | null>(null)

const toneClass: Record<Tone, string> = {
  success: 'border-success text-success',
  danger: 'border-danger text-danger',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const idRef = useRef(0)

  const remove = useCallback((id: number) => {
    setItems((cur) => cur.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback((msg: string, tone?: Tone) => {
    const id = ++idRef.current
    setItems((cur) => [...cur, { id, msg, tone }])
  }, [])

  return (
    <Ctx.Provider value={{ toast }}>
      <T.Provider>
        {children}
        {items.map((t) => (
          <T.Root
            key={t.id}
            duration={4000}
            onOpenChange={(open) => {
              if (!open) remove(t.id)
            }}
            className={cn(
              'rounded border bg-card p-3 text-sm shadow-lg',
              t.tone ? toneClass[t.tone] : 'border-border',
            )}
          >
            <T.Title>{t.msg}</T.Title>
          </T.Root>
        ))}
        <T.Viewport
          className="fixed bottom-0 inset-x-0 p-4 flex flex-col gap-2 z-[60]"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        />
      </T.Provider>
    </Ctx.Provider>
  )
}

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>')
  return ctx
}
