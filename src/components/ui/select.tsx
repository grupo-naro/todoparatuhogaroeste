'use client'
import * as S from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'

export function Select({
  value,
  onValueChange,
  options,
  placeholder,
  className,
  'aria-label': ariaLabel,
}: {
  value: string
  onValueChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
  className?: string
  'aria-label'?: string
}) {
  return (
    <S.Root value={value} onValueChange={onValueChange}>
      <S.Trigger
        aria-label={ariaLabel}
        className={cn(
          'inline-flex w-full items-center justify-between gap-2 rounded border border-border px-3 min-h-11 text-base md:text-sm',
          className,
        )}
      >
        <S.Value placeholder={placeholder} />
        <S.Icon>
          <ChevronDown size={16} />
        </S.Icon>
      </S.Trigger>
      <S.Portal>
        <S.Content className="z-50 overflow-hidden rounded border border-border bg-card shadow-lg">
          <S.Viewport className="p-1">
            {options.map((opt) => (
              <S.Item
                key={opt.value}
                value={opt.value}
                className="flex cursor-pointer items-center justify-between gap-2 rounded px-3 min-h-11 text-base md:text-sm outline-none data-[highlighted]:bg-border/50"
              >
                <S.ItemText>{opt.label}</S.ItemText>
                <S.ItemIndicator>
                  <Check size={16} />
                </S.ItemIndicator>
              </S.Item>
            ))}
          </S.Viewport>
        </S.Content>
      </S.Portal>
    </S.Root>
  )
}
