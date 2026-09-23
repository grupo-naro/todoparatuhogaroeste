import { requireRole } from '@/server/auth/guards'
import { listCustomers } from '@/server/queries/customers'
import { CustomersList } from '@/components/clientes/CustomersList'

export default async function ClientesPage() {
  await requireRole(['ADMIN', 'VENDEDOR'])
  const customers = await listCustomers()
  return (
    <section>
      <h1 className="text-xl font-semibold mb-4">Clientes</h1>
      <CustomersList customers={customers} />
    </section>
  )
}
