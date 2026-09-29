'use client'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { Period } from '@/lib/period'
import { useFilterTransition } from '@/components/ui/filter-transition'

const OPTIONS: { value: Period; label: string }[] = [
  { value: 'day', label: 'Hoy' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
]

export function PeriodSelector({ period }: { period: Period }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { start } = useFilterTransition()

  function handleChange(value: Period) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('period', value)
    start(() => router.push(`${pathname}?${params.toString()}`))
  }

  return (
    <div className="flex gap-2 mb-4" role="group" aria-label="Período">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={period === opt.value}
          onClick={() => handleChange(opt.value)}
          className={`px-3 min-h-11 rounded text-sm font-medium ${
            period === opt.value ? 'bg-primary text-primary-foreground' : 'border border-border'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
