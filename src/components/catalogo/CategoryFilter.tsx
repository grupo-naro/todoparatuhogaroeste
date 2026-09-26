'use client'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

export function CategoryFilter({ categories }: { categories: { value: string; label: string }[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const selected = searchParams.get('categoria') ?? ''

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set('categoria', value)
    else params.delete('categoria')
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="mb-4 max-w-xs">
      <label className="flex flex-col gap-1">
        <span className="text-sm">Categoría</span>
        <select value={selected} onChange={handleChange} aria-label="Categoría"
          className="w-full border border-border rounded px-3 min-h-11 text-base md:text-sm bg-transparent">
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </label>
    </div>
  )
}
