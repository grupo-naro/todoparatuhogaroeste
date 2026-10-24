import 'server-only'
import { prisma } from '@/server/db'
import { toNumber } from '@/lib/pricing'
import { getPeriodRange, type Period } from '@/lib/period'
import { countReadyReservations, listUnresolvedDeposits } from '@/server/queries/reservations'

export const LOW_STOCK_THRESHOLD = 3

export type AdminDashboardStats = {
  totalFacturado: number
  cantidadVentas: number
  clientesNuevos: number
  ventasAnuladas: number
  /** Señas cobradas en el período, netas de devoluciones: plata que entró aparte de las ventas. */
  senasCobradas: number
  reservasListas: number
  senasSinResolver: number
  stockBajo: { variantId: string; productName: string; variantName: string; quantity: number }[]
}

export async function getAdminDashboardStats(period: Period): Promise<AdminDashboardStats> {
  const { from, to } = getPeriodRange(period)
  const ventasWhere = { cancelledAt: null, createdAt: { gte: from, lte: to } }

  const [cantidadVentas, sumResult, clientesNuevos, ventasAnuladas, stockBajoRows, senaRows, reservasListas, sinResolver] = await Promise.all([
    prisma.sale.count({ where: ventasWhere }),
    prisma.sale.aggregate({ where: ventasWhere, _sum: { total: true, depositApplied: true } }),
    prisma.customer.count({ where: { createdAt: { gte: from, lte: to } } }),
    prisma.sale.count({ where: { cancelledAt: { gte: from, lte: to } } }),
    prisma.productVariant.findMany({
      // Una variante sin fila de InventoryStock significa 0 unidades (mismo
      // criterio que el resto de la app — ver inventory.ts y el filtro "Sin
      // stock" de /deposito), así que también cuenta como stock bajo.
      where: { OR: [{ stock: { quantity: { lte: LOW_STOCK_THRESHOLD } } }, { stock: null }] },
      select: { id: true, name: true, stock: { select: { quantity: true } }, product: { select: { name: true } } },
    }),
    prisma.reservationPayment.groupBy({ by: ['kind'], where: { createdAt: { gte: from, lte: to } }, _sum: { amount: true } }),
    countReadyReservations(),
    listUnresolvedDeposits(),
  ])
  const senaTotal = (kind: 'SENA' | 'DEVOLUCION') => toNumber(senaRows.find((r) => r.kind === kind)?._sum.amount) ?? 0

  return {
    // Lo ya cobrado como seña no se cuenta de nuevo: figura en senasCobradas.
    totalFacturado: (toNumber(sumResult._sum.total) ?? 0) - (toNumber(sumResult._sum.depositApplied) ?? 0),
    cantidadVentas,
    clientesNuevos,
    ventasAnuladas,
    senasCobradas: senaTotal('SENA') - senaTotal('DEVOLUCION'),
    reservasListas,
    senasSinResolver: sinResolver.length,
    stockBajo: stockBajoRows
      .map((v) => ({ variantId: v.id, productName: v.product.name, variantName: v.name, quantity: v.stock?.quantity ?? 0 }))
      .sort((a, b) => a.quantity - b.quantity)
      .slice(0, 5),
  }
}

export type VendedorDashboardStats = { cantidadPedidos: number; reservasListas: number }

export async function getVendedorDashboardStats(userId: string, period: Period): Promise<VendedorDashboardStats> {
  const { from, to } = getPeriodRange(period)
  const [cantidadPedidos, reservasListas] = await Promise.all([
    prisma.sale.count({ where: { userId, cancelledAt: null, createdAt: { gte: from, lte: to } } }),
    countReadyReservations(userId),
  ])
  return { cantidadPedidos, reservasListas }
}
