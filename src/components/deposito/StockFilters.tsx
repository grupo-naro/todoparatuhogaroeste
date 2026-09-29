'use client'
import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useFilterTransition } from '@/components/ui/filter-transition'

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
  const { start } = useFilterTransition()

  const [q, setQ] = useState(searchParams.get('q') ?? '')
  const [categoryId, setCategoryId] = useState(searchParams.get('categoryId') ?? '')
  const [status, setStatus] = useState<Status>((searchParams.get('status') as Status) ?? 'todos')
  const [showFilters, setShowFilters] = useState(false)

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

  // Ref con los searchParams actuales para que pushParams preserve params
  // ajenos a este componente (p. ej. sort/dir) en lugar de partir de cero.
  const searchParamsRef = useRef(searchParams)
  useEffect(() => {
    searchParamsRef.current = searchParams
  }, [searchParams])

  function pushParams(next: { q: string; categoryId: string; status: Status }) {
    const params = new URLSearchParams(searchParamsRef.current.toString())
    if (next.q) params.set('q', next.q)
    else params.delete('q')
    if (next.categoryId) params.set('categoryId', next.categoryId)
    else params.delete('categoryId')
    if (next.status !== 'todos') params.set('status', next.status)
    else params.delete('status')
    start(() => router.push(`${pathname}?${params.toString()}`))
  }

  // Evita que el efecto debounceado dispare un push espurio al montar (lo que
  // pisaría params existentes como sort/dir con un push idéntico pero innecesario).
  const isFirstRun = useRef(true)
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false
      return
    }
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

      {/* Instancia única: colapsable en < md vía estado de React (el toggle
          nativo <details> no puede revelarse desde un descendiente cuando el
          UA lo colapsa con content-visibility: hidden); en ≥ md siempre visible. */}
      <button
        type="button"
        className="md:hidden min-h-11 flex items-center gap-1"
        aria-expanded={showFilters}
        aria-controls="stock-filtros"
        onClick={() => setShowFilters((v) => !v)}
      >
        Filtros
      </button>
      <div id="stock-filtros" className={`${showFilters ? 'block' : 'hidden'} md:block pt-2 md:pt-0`}>
        {filterControls}
      </div>
    </div>
  )
}
