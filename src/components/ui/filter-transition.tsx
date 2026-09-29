'use client'
import { createContext, useContext, useTransition, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Ctx = { pending: boolean; start: (fn: () => void) => void }

const FilterTransitionContext = createContext<Ctx>({ pending: false, start: (fn) => fn() })

export function FilterTransition({ children }: { children: ReactNode }) {
  const [pending, start] = useTransition()
  return <FilterTransitionContext.Provider value={{ pending, start }}>{children}</FilterTransitionContext.Provider>
}

export function useFilterTransition() {
  return useContext(FilterTransitionContext)
}

export function PendingFade({ children, className }: { children: ReactNode; className?: string }) {
  const { pending } = useFilterTransition()
  return (
    <div
      aria-busy={pending}
      className={cn('transition-opacity duration-150', pending && 'opacity-50 pointer-events-none', className)}
    >
      {children}
    </div>
  )
}
