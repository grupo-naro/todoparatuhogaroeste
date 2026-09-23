'use server'
import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { prisma } from '@/server/db'
import { requireRole } from '@/server/auth/guards'
import { variantSchema } from '@/server/validation/variant'
import { variantDisplayName } from '@/lib/pricing'
import type { SaveResult } from './products'

// `@prisma/adapter-pg` leaves `e.meta.target` undefined; the real constraint name
// is at `e.meta.driverAdapterError.cause.constraint.index`. Disambiguate the two
// unique constraints on ProductVariant: `[productId, name]` vs the global `sku`.
function variantP2002(e: unknown): SaveResult | null {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== 'P2002') return null
  const idx = String(
    (e.meta as { driverAdapterError?: { cause?: { constraint?: { index?: string } } } })
      ?.driverAdapterError?.cause?.constraint?.index ?? '',
  )
  if (idx.includes('sku')) return { ok: false, error: 'Ya existe una variante con ese SKU' }
  return { ok: false, error: 'Ya existe una variante con ese nombre en el producto' }
}

export async function createVariant(productId: string, input: unknown): Promise<SaveResult> {
  const session = await requireRole(['ADMIN', 'DEPOSITO'])
  const parsed = variantSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  const v = parsed.data
  try {
    const created = await prisma.$transaction(async (tx) => {
      const created = await tx.productVariant.create({
        data: {
          productId,
          name: variantDisplayName(v),
          medida: v.medida ?? null,
          tela: v.tela ?? null,
          color: v.color ?? null,
          cost: v.cost ?? null,
          price: v.price ?? null,
          sku: v.sku ?? null,
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
      return created
    })
    revalidatePath(`/productos/${productId}`)
    revalidatePath('/deposito')
    return { ok: true, id: created.id }
  } catch (e) {
    const hit = variantP2002(e)
    if (hit) return hit
    throw e
  }
}

export async function updateVariant(id: string, input: unknown): Promise<SaveResult> {
  await requireRole(['ADMIN', 'DEPOSITO'])
  const parsed = variantSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  const v = parsed.data
  try {
    const updated = await prisma.productVariant.update({
      where: { id },
      data: {
        name: variantDisplayName(v),
        medida: v.medida ?? null,
        tela: v.tela ?? null,
        color: v.color ?? null,
        cost: v.cost ?? null,
        price: v.price ?? null,
        sku: v.sku ?? null,
      },
    })
    revalidatePath(`/productos/${updated.productId}`)
    return { ok: true, id }
  } catch (e) {
    const hit = variantP2002(e)
    if (hit) return hit
    throw e
  }
}

export async function deleteVariant(id: string): Promise<SaveResult> {
  await requireRole(['ADMIN', 'DEPOSITO'])
  const variant = await prisma.productVariant.findUniqueOrThrow({
    where: { id },
    include: { stock: true, _count: { select: { transactions: true } } },
  })
  if ((variant.stock?.quantity ?? 0) > 0) return { ok: false, error: 'La variante tiene stock' }
  if (variant._count.transactions > 0)
    return { ok: false, error: 'La variante tiene movimientos registrados' }
  const activas = await prisma.productVariant.count({ where: { productId: variant.productId } })
  if (activas <= 1) return { ok: false, error: 'El producto debe tener al menos una variante' }
  await prisma.productVariant.delete({ where: { id } })
  revalidatePath(`/productos/${variant.productId}`)
  return { ok: true, id }
}
