import Link from 'next/link'
import Image from 'next/image'
import { ImageOff } from 'lucide-react'
import type { ProductRow } from '@/server/queries/products'
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table'
import { money } from '@/lib/format'

function CoverThumb({ url }: { url: string | null }) {
  if (!url) {
    return (
      <div className="flex size-10 items-center justify-center rounded bg-border/30 text-muted">
        <ImageOff className="size-4" />
      </div>
    )
  }
  return <Image src={url} alt="" width={40} height={40} className="size-10 rounded object-cover" />
}

export function ProductList({ rows }: { rows: ProductRow[] }) {
  return (
    <>
      {/* ≥ md: tabla */}
      <div className="hidden md:block mt-4">
        <Table>
          <Thead>
            <Tr><Th>Foto</Th><Th>Producto</Th><Th>Categoría</Th><Th className="text-right">Variantes</Th>
              <Th className="text-right">Costo sug.</Th><Th className="text-right">PVP sug.</Th></Tr>
          </Thead>
          <Tbody>
            {rows.map((p) => (
              <Tr key={p.id}>
                <Td><CoverThumb url={p.coverImageUrl} /></Td>
                <Td><Link href={`/productos/${p.id}`} className="underline">{p.name}</Link></Td>
                <Td>{p.categoryName}</Td>
                <Td className="text-right">{p.variantCount}</Td>
                <Td className="text-right">{money(p.defaultCost)}</Td>
                <Td className="text-right">{money(p.defaultPrice)}</Td>
              </Tr>
            ))}
            {rows.length === 0 && <Tr><Td colSpan={6} className="text-center text-muted">Sin resultados</Td></Tr>}
          </Tbody>
        </Table>
      </div>

      {/* < md: tarjetas */}
      <ul className="md:hidden mt-4 space-y-2">
        {rows.map((p) => (
          <li key={p.id}>
            <article className="border border-border rounded-lg bg-card p-3 flex gap-3">
              <CoverThumb url={p.coverImageUrl} />
              <div className="flex-1">
                <Link href={`/productos/${p.id}`} className="font-medium underline">{p.name}</Link>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                  <dt className="text-muted">Categoría</dt><dd>{p.categoryName}</dd>
                  <dt className="text-muted">Variantes</dt><dd>{p.variantCount}</dd>
                  <dt className="text-muted">Costo sug.</dt><dd>{money(p.defaultCost)}</dd>
                  <dt className="text-muted">PVP sug.</dt><dd>{money(p.defaultPrice)}</dd>
                </dl>
              </div>
            </article>
          </li>
        ))}
        {rows.length === 0 && <li className="text-center text-muted py-4">Sin resultados</li>}
      </ul>
    </>
  )
}
