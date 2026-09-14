import { requireRole } from '@/server/auth/guards'
import { listUsers } from '@/server/queries/users'
import { UserManager } from '@/components/forms/UserManager'

export default async function UsuariosPage() {
  await requireRole('ADMIN')
  const users = await listUsers()
  return (
    <section className="max-w-3xl">
      <h1 className="text-xl font-semibold mb-4">Usuarios</h1>
      <UserManager users={users} />
    </section>
  )
}
