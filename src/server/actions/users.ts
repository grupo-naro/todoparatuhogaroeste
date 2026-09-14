'use server'
import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { prisma } from '@/server/db'
import { requireRole } from '@/server/auth/guards'
import { hashPassword } from '@/server/auth/password'
import { createUserSchema } from '@/server/validation/user'

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
