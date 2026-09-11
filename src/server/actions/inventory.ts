'use server'
import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/server/db'
import { requireUser } from '@/server/auth/guards'
import { stockRowSchema } from '@/server/validation/inventory'

export type BatchRowResult =
  | { variantId: string; ok: true; delta: number; quantityAfter: number }
  | { variantId: string; ok: false; error: string }

export type BatchResult = { batchId: string; saved: number; failed: number; results: BatchRowResult[] }

export async function saveInitialStockBatch(rows: unknown): Promise<BatchResult> {
  const session = await requireUser()
  const asArray = z.array(z.unknown()).min(1, 'El lote está vacío').parse(rows)

  const valid: { variantId: string; counted: number }[] = []
  const results: BatchRowResult[] = []
  for (const raw of asArray) {
    const parsed = stockRowSchema.safeParse(raw)
    if (parsed.success) valid.push(parsed.data)
    else {
      const vid = (raw as { variantId?: string })?.variantId ?? 'desconocida'
      results.push({ variantId: vid, ok: false, error: parsed.error.issues[0].message })
    }
  }

  const batchId = randomUUID()

  if (valid.length > 0) {
    try {
      const applied = await prisma.$transaction(async (tx) => {
        const out: BatchRowResult[] = []
        for (const row of valid) {
          const current = await tx.inventoryStock.findUnique({ where: { variantId: row.variantId } })
          const before = current?.quantity ?? 0
          const delta = row.counted - before
          await tx.inventoryStock.upsert({
            where: { variantId: row.variantId },
            update: { quantity: row.counted },
            create: { variantId: row.variantId, quantity: row.counted },
          })
          await tx.inventoryTransaction.create({
            data: {
              variantId: row.variantId, type: 'CARGA_INICIAL',
              quantityDelta: delta, quantityAfter: row.counted,
              userId: session.sub, batchId,
            },
          })
          out.push({ variantId: row.variantId, ok: true, delta, quantityAfter: row.counted })
        }
        return out
      })
      results.push(...applied)
    } catch {
      for (const row of valid) {
        results.push({ variantId: row.variantId, ok: false, error: 'No se pudo guardar el lote' })
      }
    }
  }

  // Mantener el orden de entrada
  const order = new Map(asArray.map((r, i) => [(r as { variantId?: string })?.variantId, i]))
  results.sort((a, b) => (order.get(a.variantId) ?? 0) - (order.get(b.variantId) ?? 0))

  const saved = results.filter((r) => r.ok).length
  if (saved > 0) {
    revalidatePath('/deposito')
    revalidatePath('/carga-inicial')
  }
  return { batchId, saved, failed: results.length - saved, results }
}
