'use client'
import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useFilterTransition } from '@/components/ui/filter-transition'

export function CatalogFilters({ categories }: { categories: { value: string; label: string }[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { start } = useFilterTransition()

  const [q, setQ] = useState(searchParams.get('q') ?? '')
  const [categoria, setCategoria] = useState(searchParams.get('categoria') ?? '')

  useEffect(() => {
    const timeout = setTimeout(() => {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (categoria) params.set('categoria', categoria)
      start(() => router.push(`${pathname}?${params.toString()}`))
    }, 300)
    return () => clearTimeout(timeout)
  }, [q, categoria, pathname, router, start])

  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
      <label className="flex flex-1 flex-col gap-1">
        <span className="text-sm">Buscar producto</span>
        <input
          aria-label="Buscar producto"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nombre, medida, tela, color…"
          className="w-full border border-border rounded px-3 min-h-11 text-base md:text-sm bg-transparent"
        />
      </label>
      <label className="flex flex-col gap-1 sm:max-w-xs">
        <span className="text-sm">Categoría</span>
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} aria-label="Categoría"
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
