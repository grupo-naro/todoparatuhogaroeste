import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
}

const variants = {
  primary: 'bg-primary text-primary-foreground hover:opacity-90',
  ghost: 'hover:bg-border/50',
  danger: 'bg-danger text-white hover:opacity-90',
}
const sizes = { sm: 'px-2 py-1 text-xs', md: 'px-3 min-h-11 text-sm' }

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => (
    <button ref={ref}
      className={cn('inline-flex items-center justify-center rounded font-medium disabled:opacity-60 disabled:pointer-events-none',
        variants[variant], sizes[size], className)}
      {...props} />
  ),
)
Button.displayName = 'Button'
