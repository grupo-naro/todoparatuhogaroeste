import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn('w-full border border-border rounded px-3 min-h-11 text-base md:text-sm', className)}
      {...props}
    />
  ),
)
Input.displayName = 'Input'
