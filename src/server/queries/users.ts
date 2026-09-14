import 'server-only'
import { prisma } from '@/server/db'

export async function listUsers() {
  const rows = await prisma.user.findMany({ orderBy: { name: 'asc' } })
  return rows.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    active: u.active,
    hasDni: u.dni !== null,
  }))
}
