import type { CustomerRow } from '@/server/queries/customers'
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table'
import { money, integer } from '@/lib/format'

export function CustomersList({ customers }: { customers: CustomerRow[] }) {
  return (
    <>
      <div className="hidden md:block">
        <Table>
          <Thead>
            <Tr>
              <Th>Nombre</Th><Th>Teléfono</Th>
              <Th className="text-right">Compras</Th><Th className="text-right">Gasto total</Th><Th></Th>
            </Tr>
          </Thead>
          <Tbody>
            {customers.map((c) => (
              <Tr key={c.id}>
                <Td>{c.name}</Td>
                <Td>{c.phone}</Td>
                <Td className="text-right">{integer(c.purchaseCount)}</Td>
                <Td className="text-right">{money(c.totalSpent)}</Td>
                <Td>{c.isRecurring && <span className="text-success text-xs font-medium">Recurrente</span>}</Td>
              </Tr>
            ))}
            {customers.length === 0 && (
              <Tr><Td colSpan={5} className="text-center text-muted">Sin clientes todavía</Td></Tr>
            )}
          </Tbody>
        </Table>
      </div>

      <ul className="md:hidden space-y-2">
        {customers.map((c) => (
          <li key={c.id}>
            <article className="border border-border rounded-lg bg-card p-3">
              <div className="flex items-center justify-between">
                <strong>{c.name}</strong>
                {c.isRecurring && <span className="text-success text-xs font-medium">Recurrente</span>}
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                <dt className="text-muted">Teléfono</dt><dd>{c.phone}</dd>
                <dt className="text-muted">Compras</dt><dd>{integer(c.purchaseCount)}</dd>
                <dt className="text-muted">Gasto total</dt><dd>{money(c.totalSpent)}</dd>
              </dl>
            </article>
          </li>
        ))}
        {customers.length === 0 && <li className="text-center text-muted py-4">Sin clientes todavía</li>}
      </ul>
    </>
  )
}
