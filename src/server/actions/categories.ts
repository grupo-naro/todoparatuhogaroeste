'use server'
import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { prisma } from '@/server/db'
import { requireRole } from '@/server/auth/guards'
import { slugify } from '@/lib/format'
import { categorySchema } from '@/server/validation/category'

export type ActionResult = { ok: true } | { ok: false; error: string }

export async function createCategory(_prev: unknown, formData: FormData): Promise<ActionResult> {
  await requireRole('ADMIN')
  const parsed = categorySchema.safeParse({ name: formData.get('name') })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  try {
    await prisma.category.create({ data: { name: parsed.data.name, slug: slugify(parsed.data.name) } })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
      return { ok: false, error: 'Ya existe una categoría con ese nombre' }
    throw e
  }
  revalidatePath('/categorias')
  return { ok: true }
}

export async function updateCategory(id: string, formData: FormData): Promise<ActionResult> {
  await requireRole('ADMIN')
  const parsed = categorySchema.safeParse({ name: formData.get('name') })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  try {
    await prisma.category.update({ where: { id }, data: { name: parsed.data.name, slug: slugify(parsed.data.name) } })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
      return { ok: false, error: 'Ya existe una categoría con ese nombre' }
    throw e
  }
  revalidatePath('/categorias')
  return { ok: true }
}

export async function archiveCategory(id: string): Promise<ActionResult> {
  await requireRole('ADMIN')
  const activos = await prisma.product.count({ where: { categoryId: id, archivedAt: null } })
  if (activos > 0) return { ok: false, error: 'No se puede archivar: tiene productos activos' }
  await prisma.category.update({ where: { id }, data: { archivedAt: new Date() } })
  revalidatePath('/categorias')
  return { ok: true }
}
