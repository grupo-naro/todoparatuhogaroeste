import Link from 'next/link'
import type { SaleRow } from '@/server/queries/sales'
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table'
import { money, formatDate } from '@/lib/format'
import { PAYMENT_METHOD_LABELS } from '@/lib/constants'

export function SalesList({ sales }: { sales: SaleRow[] }) {
  return (
    <>
      <div className="hidden lg:block mt-4">
        <Table>
          <Thead>
            <Tr>
              <Th>N°</Th><Th>Fecha</Th><Th>Vendedora</Th><Th>Pago</Th>
              <Th className="text-right">Total</Th><Th>Estado</Th>
            </Tr>
          </Thead>
          <Tbody>
            {sales.map((s) => (
              <Tr key={s.id}>
                <Td><Link href={`/ventas/${s.id}`} className="underline">{s.number}</Link></Td>
                <Td>{formatDate(s.createdAt)}</Td>
                <Td>{s.userName}</Td>
                <Td>{PAYMENT_METHOD_LABELS[s.paymentMethod]}</Td>
                <Td className="text-right">{money(s.total)}</Td>
                <Td>{s.cancelledAt ? <span className="text-danger">Anulada</span> : 'Confirmada'}</Td>
              </Tr>
            ))}
            {sales.length === 0 && (
              <Tr><Td colSpan={6} className="text-center text-muted">Sin ventas todavía</Td></Tr>
            )}
          </Tbody>
        </Table>
      </div>

      <ul className="lg:hidden mt-4 grid gap-2 md:grid-cols-2">
        {sales.map((s) => (
          <li key={s.id}>
            <Link href={`/ventas/${s.id}`}>
              <article className="border border-border rounded-lg bg-card p-3 h-full active:bg-border/40 transition-colors">
                <div className="flex items-center justify-between">
                  <strong>Ticket N° {s.number}</strong>
                  {s.cancelledAt && <span className="text-danger text-xs">Anulada</span>}
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                  <dt className="text-muted">Fecha</dt><dd>{formatDate(s.createdAt)}</dd>
                  <dt className="text-muted">Vendedora</dt><dd>{s.userName}</dd>
                  <dt className="text-muted">Pago</dt><dd>{PAYMENT_METHOD_LABELS[s.paymentMethod]}</dd>
                  <dt className="text-muted">Total</dt><dd>{money(s.total)}</dd>
                </dl>
              </article>
            </Link>
          </li>
        ))}
        {sales.length === 0 && <li className="text-center text-muted py-4 md:col-span-2">Sin ventas todavía</li>}
      </ul>
    </>
  )
}
