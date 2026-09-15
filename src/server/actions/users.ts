'use server'
import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { prisma } from '@/server/db'
import { requireRole } from '@/server/auth/guards'
import { hashPassword } from '@/server/auth/password'
import { createUserSchema } from '@/server/validation/user'
import { ROLES, type RoleName } from '@/lib/constants'

export type ActionResult = { ok: true } | { ok: false; error: string }

export async function createUser(_prev: unknown, formData: FormData): Promise<ActionResult> {
  await requireRole('ADMIN')
  const parsed = createUserSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    role: formData.get('role'),
    dni: formData.get('dni'),
  })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  try {
    await prisma.user.create({
      data: { ...parsed.data, passwordHash: await hashPassword(parsed.data.dni), mustChangePassword: true },
    })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      // Same disambiguation approach as `variantP2002` in `src/server/actions/variants.ts`:
      // `@prisma/adapter-pg` doesn't populate `e.meta.target`, the real constraint name
      // lives at `e.meta.driverAdapterError.cause.constraint.index`.
      const idx = String(
        (e.meta as { driverAdapterError?: { cause?: { constraint?: { index?: string } } } })
          ?.driverAdapterError?.cause?.constraint?.index ?? '',
      )
      if (idx.includes('dni')) return { ok: false, error: 'Ya existe un usuario con ese DNI' }
      return { ok: false, error: 'Ya existe un usuario con ese email' }
    }
    throw e
  }
  revalidatePath('/usuarios')
  return { ok: true }
}

export async function resetUserPassword(id: string): Promise<ActionResult> {
  await requireRole('ADMIN')
  const user = await prisma.user.findUniqueOrThrow({ where: { id } })
  if (!user.dni) return { ok: false, error: 'Este usuario no tiene DNI cargado, no se puede resetear la contraseña' }
  await prisma.user.update({
    where: { id },
    data: { passwordHash: await hashPassword(user.dni), mustChangePassword: true },
  })
  revalidatePath('/usuarios')
  return { ok: true }
}

// Cuenta los ADMIN activos que quedarían si `id` dejara de ser un ADMIN activo
// (por cambio de rol o por desactivación) — excluye a `id` del conteo.
async function activeAdminCountExcluding(id: string): Promise<number> {
  return prisma.user.count({ where: { role: 'ADMIN', active: true, id: { not: id } } })
}

export async function updateUserRole(id: string, role: RoleName): Promise<ActionResult> {
  await requireRole('ADMIN')
  if (!ROLES.includes(role)) return { ok: false, error: 'Rol inválido' }
  if (role !== 'ADMIN') {
    const user = await prisma.user.findUniqueOrThrow({ where: { id } })
    if (user.role === 'ADMIN' && user.active && (await activeAdminCountExcluding(id)) === 0)
      return { ok: false, error: 'No se puede quitar el rol de ADMIN: no quedaría ningún administrador activo' }
  }
  await prisma.user.update({ where: { id }, data: { role } })
  revalidatePath('/usuarios')
  return { ok: true }
}

export async function setUserActive(id: string, active: boolean): Promise<ActionResult> {
  await requireRole('ADMIN')
  if (!active) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id } })
    if (user.role === 'ADMIN' && user.active && (await activeAdminCountExcluding(id)) === 0)
      return { ok: false, error: 'No se puede desactivar: no quedaría ningún administrador activo' }
  }
  await prisma.user.update({ where: { id }, data: { active } })
  revalidatePath('/usuarios')
  return { ok: true }
}
