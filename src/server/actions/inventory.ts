'use server'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/server/db'
import { requireRole } from '@/server/auth/guards'
import { adjustSchema } from '@/server/validation/inventory'
import { allocateWaiting, lockVariantStock, reservedUnits } from '@/server/reservations/stock'

export async function adjustStock(input: unknown) {
  const session = await requireRole(['ADMIN', 'DEPOSITO'])
  const parsed = adjustSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message }
  const { variantId, mode, note } = parsed.data

  const result = await prisma.$transaction(async (tx) => {
    await lockVariantStock(tx, variantId)
    const current = await tx.inventoryStock.findUnique({ where: { variantId } })
    const before = current?.quantity ?? 0
    const quantity = mode === 'set' ? parsed.data.quantity : before + parsed.data.delta
    if (quantity < 0) return null
    const reserved = await reservedUnits(tx, variantId)
    if (quantity < reserved) return { reserved }
    const delta = quantity - before
    await tx.inventoryStock.upsert({
      where: { variantId }, update: { quantity }, create: { variantId, quantity },
    })
    await tx.inventoryTransaction.create({
      data: { variantId, type: 'AJUSTE', quantityDelta: delta, quantityAfter: quantity, note, userId: session.sub },
    })
    if (delta > 0) await allocateWaiting(tx, variantId)
    return { delta, quantityAfter: quantity }
  })
  if (!result) return { ok: false as const, error: 'El stock no puede quedar negativo' }
  if ('reserved' in result) {
    return { ok: false as const, error: `Hay ${result.reserved} unidades reservadas: el stock no puede quedar por debajo` }
  }
  revalidatePath('/deposito')
  return { ok: true as const, ...result }
}
