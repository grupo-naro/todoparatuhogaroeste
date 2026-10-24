import 'server-only'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/server/db'

type Tx = Prisma.TransactionClient

const OPEN = ['ESPERANDO', 'LISTA'] as const

// Toma la fila de stock de la variante con FOR UPDATE: dos operaciones
// simultáneas sobre la última unidad se ordenan acá y no sobrevenden.
export async function lockVariantStock(tx: Tx, variantId: string): Promise<void> {
  await tx.inventoryStock.upsert({ where: { variantId }, update: {}, create: { variantId, quantity: 0 } })
  await tx.$queryRaw`SELECT id FROM "InventoryStock" WHERE "variantId" = ${variantId}::uuid FOR UPDATE`
}

export async function reservedUnits(tx: Tx, variantId: string): Promise<number> {
  const r = await tx.reservationItem.aggregate({
    where: { variantId, reservation: { status: { in: [...OPEN] } } },
    _sum: { allocated: true },
  })
  return r._sum.allocated ?? 0
}

export async function availableUnits(tx: Tx, variantId: string): Promise<number> {
  const stock = await tx.inventoryStock.findUnique({ where: { variantId } })
  return Math.max(0, (stock?.quantity ?? 0) - (await reservedUnits(tx, variantId)))
}

export async function reservedUnitsByVariant(variantIds: string[]): Promise<Map<string, number>> {
  const rows = await prisma.reservationItem.groupBy({
    by: ['variantId'],
    where: { variantId: { in: variantIds }, reservation: { status: { in: [...OPEN] } } },
    _sum: { allocated: true },
  })
  return new Map(rows.map((r) => [r.variantId, r._sum.allocated ?? 0]))
}

// Pasa a LISTA una reserva ESPERANDO a la que ya no le falta nada.
export async function refreshReservationStatus(tx: Tx, reservationId: string): Promise<void> {
  const items = await tx.reservationItem.findMany({ where: { reservationId } })
  if (items.length > 0 && items.every((i) => i.allocated >= i.quantity)) {
    await tx.reservation.updateMany({
      where: { id: reservationId, status: 'ESPERANDO' },
      data: { status: 'LISTA', readyAt: new Date() },
    })
  }
}

// Reparte el stock disponible de la variante entre las reservas que lo esperan,
// de la más antigua a la más nueva.
export async function allocateWaiting(tx: Tx, variantId: string): Promise<void> {
  await lockVariantStock(tx, variantId)
  let available = await availableUnits(tx, variantId)
  if (available === 0) return

  const waiting = await tx.reservationItem.findMany({
    where: { variantId, reservation: { status: 'ESPERANDO' } },
    orderBy: { reservation: { createdAt: 'asc' } },
  })
  const touched = new Set<string>()
  for (const item of waiting) {
    const missing = item.quantity - item.allocated
    if (missing <= 0 || available <= 0) continue
    const give = Math.min(missing, available)
    await tx.reservationItem.update({ where: { id: item.id }, data: { allocated: { increment: give } } })
    available -= give
    touched.add(item.reservationId)
  }
  for (const id of touched) await refreshReservationStatus(tx, id)
}
