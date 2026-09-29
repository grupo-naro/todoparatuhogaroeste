import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  loading?: boolean
}

const variants = {
  primary: 'bg-primary text-primary-foreground hover:opacity-90',
  ghost: 'hover:bg-border/50',
  danger: 'bg-danger text-white hover:opacity-90',
}
const sizes = { sm: 'px-2 min-h-11 text-xs', md: 'px-3 min-h-11 text-sm' }

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ className, variant = 'primary', size = 'md', loading = false, disabled, children, ...props }, ref) => (
    <button ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn('inline-flex items-center justify-center gap-2 rounded font-medium transition-opacity active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none',
        variants[variant], sizes[size], className)}
      {...props}>
      {loading && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
      {children}
    </button>
  ),
)
Button.displayName = 'Button'
