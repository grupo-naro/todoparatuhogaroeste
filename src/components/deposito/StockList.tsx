import type { StockRow } from '@/server/queries/inventory'
import { Table, Thead, Tbody, Tr, Td } from '@/components/ui/table'
import { StockTableHeader } from './StockTableHeader'
import { AdjustStockDialog } from './AdjustStockDialog'
import { money, integer } from '@/lib/format'

export function StockList({
  rows, totalVariants, totalUnits, sort, dir,
}: {
  rows: StockRow[]
  totalVariants: number
  totalUnits: number
  sort?: 'producto' | 'stock' | 'precio'
  dir?: 'asc' | 'desc'
}) {
  return (
    <>
      {/* ≥ lg: tabla */}
      <div className="hidden lg:block mt-4">
        <Table>
          <Thead>
            <StockTableHeader sort={sort} dir={dir} />
          </Thead>
          <Tbody>
            {rows.map((r) => (
              <Tr key={r.variantId}>
                <Td>{r.productName}</Td>
                <Td>{r.variantName}</Td>
                <Td>{r.categoryName}</Td>
                <Td className="text-right">{integer(r.quantity)}</Td>
                <Td className="text-right">{money(r.unitCost)}</Td>
                <Td className="text-right">{money(r.unitPrice)}</Td>
                <Td>
                  <AdjustStockDialog
                    variantId={r.variantId}
                    label={`${r.productName} · ${r.variantName}`}
                    currentQuantity={r.quantity}
                  />
                </Td>
              </Tr>
            ))}
            {rows.length === 0 && (
              <Tr><Td colSpan={7} className="text-center text-muted">Sin resultados</Td></Tr>
            )}
          </Tbody>
          <tfoot>
            <Tr>
              <Td colSpan={3} className="font-medium">{totalVariants} variantes</Td>
              <Td className="text-right font-medium">{integer(totalUnits)}</Td>
              <Td colSpan={3} />
            </Tr>
          </tfoot>
        </Table>
      </div>

      {/* < lg: tarjetas (1 col celular, 2 col tablet) */}
      <ul className="lg:hidden mt-4 grid gap-2 md:grid-cols-2">
        {rows.map((r) => (
          <li key={r.variantId}>
            <article className="border border-border rounded-lg bg-card p-3">
              <p><strong>{r.productName}</strong> · <span>{r.variantName}</span></p>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                <dt className="text-muted">Categoría</dt><dd>{r.categoryName}</dd>
                <dt className="text-muted">Stock</dt><dd>{integer(r.quantity)}</dd>
                <dt className="text-muted">Costo unit.</dt><dd>{money(r.unitCost)}</dd>
                <dt className="text-muted">Precio venta</dt><dd>{money(r.unitPrice)}</dd>
              </dl>
              <AdjustStockDialog
                variantId={r.variantId}
                label={`${r.productName} · ${r.variantName}`}
                currentQuantity={r.quantity}
                className="w-full mt-2"
              />
            </article>
          </li>
        ))}
        {rows.length === 0 && <li className="text-center text-muted py-4 md:col-span-2">Sin resultados</li>}
      </ul>
      <p className="lg:hidden mt-3 font-medium">{totalVariants} variantes · {integer(totalUnits)} unidades</p>
    </>
  )
}
