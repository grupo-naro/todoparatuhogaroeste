import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={cn('animate-pulse rounded bg-border/60', className)} {...props} />
}

export function PageSkeleton({ children, label = 'Cargando…' }: { children: React.ReactNode; label?: string }) {
  return (
    <section role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      {children}
    </section>
  )
}

export function FiltersSkeleton() {
  return (
    <div className="mb-4 space-y-3">
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-full md:w-64" />
    </div>
  )
}

export function TableSkeleton({ rows = 8, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="border border-border rounded-lg divide-y divide-border">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-3 py-3">
          {Array.from({ length: cols }, (_, j) => (
            <Skeleton key={j} className={cn('h-5', j === 0 ? 'flex-[2]' : 'flex-1')} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="border border-border rounded-lg p-3 flex flex-col gap-3">
          <Skeleton className="aspect-square w-full" />
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      ))}
    </div>
  )
}
