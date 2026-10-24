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
    for (const r of overdue) {
      await tx.reservation.update({ where: { id: r.id }, data: { status: 'VENCIDA', closedAt: now } })
      await tx.reservationItem.updateMany({ where: { reservationId: r.id }, data: { allocated: 0 } })
      for (const item of r.items) variantIds.add(item.variantId)
    }
    for (const variantId of variantIds) await allocateWaiting(tx, variantId)
    return overdue.length
  })
}
