import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

const tones = {
  neutral: 'bg-border text-muted',
  success: 'bg-success/10 text-success',
  danger: 'bg-danger/10 text-danger',
}

export function Badge({
  tone = 'neutral', className, children,
}: {
  tone?: 'neutral' | 'success' | 'danger'
  className?: string
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-2 py-0.5 text-xs font-medium',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
