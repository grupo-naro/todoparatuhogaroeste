import 'server-only'
import { prisma } from '@/server/db'
import { getStoreSettings } from '@/server/settings'
import { allocateWaiting } from './stock'

const DAY_MS = 24 * 60 * 60 * 1000

// Libera las reservas LISTA que llevan más de N días sin concretarse (si el admin
// lo activó) y reparte lo liberado a las reservas que esperaban. Devuelve cuántas venció.
export async function expireOverdueReservations(now: Date = new Date()): Promise<number> {
  const settings = await getStoreSettings()
  if (!settings.reservationExpiryEnabled) return 0
  const cutoff = new Date(now.getTime() - settings.reservationExpiryDays * DAY_MS)

  return prisma.$transaction(async (tx) => {
    const overdue = await tx.reservation.findMany({
      where: { status: 'LISTA', readyAt: { lt: cutoff } },
      include: { items: true },
    })
    const variantIds = new Set<string>()
    let expired = 0
    for (const r of overdue) {
      // Condicional: si entre la lectura y acá la concretaron o cancelaron, no se pisa.
      const claimed = await tx.reservation.updateMany({ where: { id: r.id, status: 'LISTA' }, data: { status: 'VENCIDA', closedAt: now } })
      if (claimed.count === 0) continue
      expired++
      await tx.reservationItem.updateMany({ where: { reservationId: r.id }, data: { allocated: 0 } })
      for (const item of r.items) variantIds.add(item.variantId)
    }
    for (const variantId of [...variantIds].sort()) await allocateWaiting(tx, variantId)
    return expired
  })
}
