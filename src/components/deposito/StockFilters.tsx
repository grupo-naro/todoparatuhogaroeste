'use client'
import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'

type Status = 'todos' | 'disponible' | 'sin_stock'

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'disponible', label: 'Disponible' },
  { value: 'sin_stock', label: 'Sin stock' },
]

export function StockFilters({ categories }: { categories: { value: string; label: string }[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [q, setQ] = useState(searchParams.get('q') ?? '')
  const [categoryId, setCategoryId] = useState(searchParams.get('categoryId') ?? '')
  const [status, setStatus] = useState<Status>((searchParams.get('status') as Status) ?? 'todos')

  // Refs para que el push debounceado de "q" siempre use los últimos valores de
  // categoría/estado, aunque el efecto no se vuelva a programar por esos cambios.
  const categoryIdRef = useRef(categoryId)
  const statusRef = useRef(status)
  useEffect(() => {
    categoryIdRef.current = categoryId
  }, [categoryId])
  useEffect(() => {
    statusRef.current = status
  }, [status])

  function pushParams(next: { q: string; categoryId: string; status: Status }) {
    const params = new URLSearchParams()
    if (next.q) params.set('q', next.q)
    if (next.categoryId) params.set('categoryId', next.categoryId)
    if (next.status !== 'todos') params.set('status', next.status)
    router.push(`${pathname}?${params.toString()}`)
  }

  useEffect(() => {
    const timeout = setTimeout(() => {
      pushParams({ q, categoryId: categoryIdRef.current, status: statusRef.current })
    }, 300)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, pathname, router])

  function handleCategoryChange(v: string) {
    setCategoryId(v)
    pushParams({ q, categoryId: v, status })
  }

  function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value as Status
    setStatus(v)
    pushParams({ q, categoryId, status: v })
  }

  const filterControls = (
    <div className="flex flex-col gap-3 md:flex-row">
      <Select
        value={categoryId}
        onValueChange={handleCategoryChange}
        options={categories}
        placeholder="Todas las categorías"
        aria-label="Categoría"
      />
      <select
        value={status}
        onChange={handleStatusChange}
        aria-label="Estado"
        className="w-full border border-border rounded px-3 min-h-11 text-base md:text-sm bg-transparent"
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  )

  return (
    <div className="mb-4 space-y-3">
      <Input
        placeholder="Buscar producto o variante…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="w-full"
      />

      {/* Instancia única: colapsable en < md (nativo, "Filtros"); en ≥ md se
          fuerza visible vía CSS (md:!block) sin duplicar los controles en el DOM. */}
      <details>
        <summary className="cursor-pointer select-none min-h-11 flex items-center md:hidden">
          Filtros
        </summary>
        <div className="pt-2 md:pt-0 md:block!">{filterControls}</div>
      </details>
    </div>
  )
}
