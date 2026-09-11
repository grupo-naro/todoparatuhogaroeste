'use client'
import type { InputHTMLAttributes } from 'react'
import { Minus, Plus } from 'lucide-react'

export function QuantityStepper({
  value, onChange, ariaLabel, inputProps,
}: {
  value: string
  onChange: (v: string) => void
  ariaLabel: string
  inputProps?: InputHTMLAttributes<HTMLInputElement>
}) {
  const item = ariaLabel.replace(/^Cantidad \(/, '(').replace(/\)$/, ')')  // "(ítem 1)"
  const step = (delta: number) => {
    const n = Number(value) || 0
    onChange(String(Math.max(0, Math.round(n) + delta)))
  }
  return (
    <div className="inline-flex items-stretch border border-border rounded overflow-hidden">
      <button type="button" aria-label={`Restar uno ${item}`} onClick={() => step(-1)}
        className="min-h-11 min-w-11 grid place-items-center hover:bg-border/40"><Minus size={16} /></button>
      <input aria-label={ariaLabel} inputMode="numeric" value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-16 text-center text-base md:text-sm border-x border-border min-h-11"
        {...inputProps} />
      <button type="button" aria-label={`Sumar uno ${item}`} onClick={() => step(1)}
        className="min-h-11 min-w-11 grid place-items-center hover:bg-border/40"><Plus size={16} /></button>
    </div>
  )
}
