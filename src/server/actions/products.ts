'use server'
import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/server/db'
import { requireUser } from '@/server/auth/guards'
import { productSchema } from '@/server/validation/product'
import { variantSchema } from '@/server/validation/variant'
import { variantDisplayName } from '@/lib/pricing'

export type SaveResult = { ok: true; id: string } | { ok: false; error: string }

const createSchema = productSchema.extend({ variants: z.array(variantSchema).optional() })

export async function createProduct(input: unknown): Promise<SaveResult> {
  await requireUser()
  const parsed = createSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  const { variants, ...base } = parsed.data
  try {
    const product = await prisma.$transaction(async (tx) => {
      const p = await tx.product.create({ data: base })
      if (!variants || variants.length === 0) {
        await tx.productVariant.create({ data: { productId: p.id, name: 'Única', isDefault: true } })
      } else {
        for (const v of variants) {
          await tx.productVariant.create({
            data: {
              productId: p.id, name: variantDisplayName(v),
              medida: v.medida ?? null, tela: v.tela ?? null, color: v.color ?? null,
              cost: v.cost ?? null, price: v.price ?? null, sku: v.sku ?? null,
            },
          })
        }
      }
      return p
    })
    revalidatePath('/productos')
    return { ok: true, id: product.id }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      // `@prisma/adapter-pg` does NOT populate `e.meta.target`; the constraint
      // identity lives in `e.meta.modelName` / `driverAdapterError.cause.constraint.index`.
      const meta = e.meta as
        | { modelName?: string; target?: unknown; driverAdapterError?: { cause?: { constraint?: { index?: string } } } }
        | undefined
      const constraint = meta?.driverAdapterError?.cause?.constraint?.index ?? String(meta?.target ?? '')
      const isVariant =
        meta?.modelName === 'ProductVariant' ||
        constraint.includes('ProductVariant') ||
        constraint.includes('productId')
      return isVariant
        ? { ok: false, error: 'Hay variantes con el mismo nombre' }
        : { ok: false, error: 'Ya existe un producto con ese nombre en la categoría' }
    }
    throw e
  }
}

export async function updateProduct(id: string, input: unknown): Promise<SaveResult> {
  await requireUser()
  const parsed = productSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  try {
    await prisma.product.update({ where: { id }, data: parsed.data })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
      return { ok: false, error: 'Ya existe un producto con ese nombre en la categoría' }
    throw e
  }
  revalidatePath('/productos')
  revalidatePath(`/productos/${id}`)
  return { ok: true, id }
}

export async function archiveProduct(id: string): Promise<SaveResult> {
  await requireUser()
  const now = new Date()
  await prisma.$transaction([
    prisma.productVariant.updateMany({ where: { productId: id, archivedAt: null }, data: { archivedAt: now } }),
    prisma.product.update({ where: { id }, data: { archivedAt: now } }),
  ])
  revalidatePath('/productos')
  return { ok: true, id }
}
