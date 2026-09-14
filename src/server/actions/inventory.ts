'use server'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/server/db'
import { requireUser } from '@/server/auth/guards'
import { adjustSchema } from '@/server/validation/inventory'

export async function adjustStock(input: unknown) {
  const session = await requireUser()
  const parsed = adjustSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message }
  const { variantId, quantity, note } = parsed.data

  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.inventoryStock.findUnique({ where: { variantId } })
    const before = current?.quantity ?? 0
    const delta = quantity - before
    await tx.inventoryStock.upsert({
      where: { variantId }, update: { quantity }, create: { variantId, quantity },
    })
    await tx.inventoryTransaction.create({
      data: { variantId, type: 'AJUSTE', quantityDelta: delta, quantityAfter: quantity, note, userId: session.sub },
    })
    return { delta, quantityAfter: quantity }
  })
  revalidatePath('/deposito')
  return { ok: true as const, ...result }
}
