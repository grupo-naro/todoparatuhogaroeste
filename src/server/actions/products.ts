'use server'
import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { del } from '@vercel/blob'
import { prisma } from '@/server/db'
import { requireRole } from '@/server/auth/guards'
import { productSchema } from '@/server/validation/product'
import { variantSchema } from '@/server/validation/variant'
import { variantDisplayName } from '@/lib/pricing'

export type SaveResult = { ok: true; id: string } | { ok: false; error: string }

const createSchema = productSchema.extend({ variants: z.array(variantSchema).optional() })

export async function createProduct(input: unknown): Promise<SaveResult> {
  const session = await requireRole(['ADMIN', 'DEPOSITO'])
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
          const created = await tx.productVariant.create({
            data: {
              productId: p.id, name: variantDisplayName(v),
              medida: v.medida ?? null, tela: v.tela ?? null, color: v.color ?? null,
              cost: v.cost ?? null, price: v.price ?? null, sku: v.sku ?? null,
            },
          })
          if (v.stockInicial != null) {
            await tx.inventoryStock.create({ data: { variantId: created.id, quantity: v.stockInicial } })
            await tx.inventoryTransaction.create({
              data: {
                variantId: created.id, type: 'CARGA_INICIAL',
                quantityDelta: v.stockInicial, quantityAfter: v.stockInicial, userId: session.sub,
              },
            })
          }
        }
      }
      return p
    })
    revalidatePath('/productos')
    revalidatePath('/deposito')
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
      if (!isVariant) return { ok: false, error: 'Ya existe un producto con ese nombre en la categoría' }
      return constraint.includes('sku')
        ? { ok: false, error: 'Hay variantes con el mismo SKU' }
        : { ok: false, error: 'Hay variantes con el mismo nombre' }
    }
    throw e
  }
}

export async function updateProduct(id: string, input: unknown): Promise<SaveResult> {
  await requireRole(['ADMIN', 'DEPOSITO'])
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

export async function deleteProduct(id: string): Promise<SaveResult> {
  await requireRole(['ADMIN', 'DEPOSITO'])
  const product = await prisma.product.findUniqueOrThrow({
    where: { id },
    include: {
      variants: { include: { stock: true, _count: { select: { transactions: true } } } },
      images: true,
    },
  })
  const hasHistory = product.variants.some((v) => (v.stock?.quantity ?? 0) > 0 || v._count.transactions > 0)
  if (hasHistory) return { ok: false, error: 'El producto tiene variantes con stock o movimientos registrados' }

  if (product.images.length > 0) await del(product.images.map((img) => img.url))

  await prisma.$transaction([
    prisma.productVariant.deleteMany({ where: { productId: id } }),
    prisma.product.delete({ where: { id } }),
  ])
  revalidatePath('/productos')
  revalidatePath('/deposito')
  return { ok: true, id }
}
