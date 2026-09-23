import 'server-only'
import { prisma } from '@/server/db'
import { toNumber } from '@/lib/pricing'
import { getPeriodRange, type Period } from '@/lib/period'

export const LOW_STOCK_THRESHOLD = 3

export type AdminDashboardStats = {
  totalFacturado: number
  cantidadVentas: number
  clientesNuevos: number
  ventasAnuladas: number
  stockBajo: { variantId: string; productName: string; variantName: string; quantity: number }[]
}

export async function getAdminDashboardStats(period: Period): Promise<AdminDashboardStats> {
  const { from, to } = getPeriodRange(period)
  const ventasWhere = { cancelledAt: null, createdAt: { gte: from, lte: to } }

  const [cantidadVentas, sumResult, clientesNuevos, ventasAnuladas, stockBajoRows] = await Promise.all([
    prisma.sale.count({ where: ventasWhere }),
    prisma.sale.aggregate({ where: ventasWhere, _sum: { total: true } }),
    prisma.customer.count({ where: { createdAt: { gte: from, lte: to } } }),
    prisma.sale.count({ where: { cancelledAt: { gte: from, lte: to } } }),
    prisma.productVariant.findMany({
      // Una variante sin fila de InventoryStock significa 0 unidades (mismo
      // criterio que el resto de la app — ver inventory.ts y el filtro "Sin
      // stock" de /deposito), así que también cuenta como stock bajo.
      where: { OR: [{ stock: { quantity: { lte: LOW_STOCK_THRESHOLD } } }, { stock: null }] },
      include: { stock: true, product: { select: { name: true } } },
    }),
  ])

  return {
    totalFacturado: toNumber(sumResult._sum.total) ?? 0,
    cantidadVentas,
    clientesNuevos,
    ventasAnuladas,
    stockBajo: stockBajoRows
      .map((v) => ({ variantId: v.id, productName: v.product.name, variantName: v.name, quantity: v.stock?.quantity ?? 0 }))
      .sort((a, b) => a.quantity - b.quantity)
      .slice(0, 5),
  }
}

export type VendedorDashboardStats = { cantidadPedidos: number }

export async function getVendedorDashboardStats(userId: string, period: Period): Promise<VendedorDashboardStats> {
  const { from, to } = getPeriodRange(period)
  const cantidadPedidos = await prisma.sale.count({
    where: { userId, cancelledAt: null, createdAt: { gte: from, lte: to } },
  })
  return { cantidadPedidos }
}
