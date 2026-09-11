'use client'
import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'

export function ProductFilters({ categories }: { categories: { value: string; label: string }[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [q, setQ] = useState(searchParams.get('q') ?? '')
  const [categoryId, setCategoryId] = useState(searchParams.get('categoryId') ?? '')

  useEffect(() => {
    const timeout = setTimeout(() => {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (categoryId) params.set('categoryId', categoryId)
      router.push(`${pathname}?${params.toString()}`)
    }, 300)
    return () => clearTimeout(timeout)
  }, [q, categoryId, pathname, router])

  const categorySelect = (
    <Select
      value={categoryId}
      onValueChange={setCategoryId}
      options={categories}
      placeholder="Todas las categorías"
      aria-label="Categoría"
    />
  )

  return (
    <div className="mb-4 space-y-3">
      <Input
        placeholder="Buscar producto…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="w-full"
      />

      {/* < md: filtro colapsable */}
      <details className="md:hidden">
        <summary className="cursor-pointer select-none py-2">Filtros</summary>
        <div className="pt-2">{categorySelect}</div>
      </details>

      {/* >= md: filtro siempre visible */}
      <div className="hidden md:block">{categorySelect}</div>
    </div>
  )
}
