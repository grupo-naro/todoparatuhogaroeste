'use client'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Th, Tr } from '@/components/ui/table'
import { useFilterTransition } from '@/components/ui/filter-transition'

type SortKey = 'producto' | 'stock' | 'precio'
type Dir = 'asc' | 'desc'

export function StockTableHeader({ sort, dir }: { sort?: SortKey; dir?: Dir }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { start } = useFilterTransition()

  function handleSort(key: SortKey) {
    const params = new URLSearchParams(searchParams.toString())
    const nextDir: Dir = sort === key && dir === 'asc' ? 'desc' : 'asc'
    params.set('sort', key)
    params.set('dir', nextDir)
    start(() => router.push(`${pathname}?${params.toString()}`))
  }

  return (
    <Tr>
      <Th sortable sorted={sort === 'producto' ? (dir ?? 'asc') : false} onSort={() => handleSort('producto')}>
        Producto
      </Th>
      <Th>Variante</Th>
      <Th>Categoría</Th>
      <Th className="text-right" sortable sorted={sort === 'stock' ? (dir ?? 'asc') : false} onSort={() => handleSort('stock')}>
        Stock
      </Th>
      <Th className="text-right">Costo unit.</Th>
      <Th className="text-right" sortable sorted={sort === 'precio' ? (dir ?? 'asc') : false} onSort={() => handleSort('precio')}>
        Precio venta
      </Th>
      <Th><span className="sr-only">Acción</span></Th>
    </Tr>
  )
}
