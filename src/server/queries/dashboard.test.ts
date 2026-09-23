import { describe, expect, it, beforeEach } from 'vitest'
import { prisma, resetDb } from '@/test/db'
import { getAdminDashboardStats, getVendedorDashboardStats, LOW_STOCK_THRESHOLD } from './dashboard'

let userId: string, v1: string, categoryId: string

const OLD = new Date('2020-01-01T12:00:00Z') // muy afuera de cualquier período posible

beforeEach(async () => {
  await resetDb()
  userId = (await prisma.user.create({ data: { email: 'a@a.com', name: 'Ana', passwordHash: 'x', role: 'VENDEDOR' } })).id
  const c = await prisma.category.create({ data: { name: 'Mesas', slug: 'mesas' } })
  categoryId = c.id
  const p = await prisma.product.create({
    data: { name: 'Mesa', categoryId, defaultPrice: 100, variants: { create: [{ name: 'A', price: 100 }] } },
    include: { variants: true },
  })
  v1 = p.variants[0].id
})

async function makeSale(overrides: { createdAt?: Date; cancelledAt?: Date | null; total?: number; userId?: string } = {}) {
  return prisma.sale.create({
    data: {
      userId: overrides.userId ?? userId,
      paymentMethod: 'EFECTIVO',
      total: overrides.total ?? 100,
      createdAt: overrides.createdAt ?? new Date(),
      cancelledAt: overrides.cancelledAt ?? null,
      items: { create: [{ variantId: v1, quantity: 1, unitPrice: 100, subtotal: 100 }] },
    },
  })
}

describe('getAdminDashboardStats', () => {
  it('cuenta y suma solo ventas no anuladas del período, ignora ventas viejas', async () => {
    await makeSale({ total: 100 })
    await makeSale({ total: 50 })
    await makeSale({ createdAt: OLD, total: 999 }) // vieja, no cuenta
    await makeSale({ total: 30, cancelledAt: new Date() }) // anulada, no cuenta en facturación
    const stats = await getAdminDashboardStats('month')
    expect(stats.cantidadVentas).toBe(2)
    expect(stats.totalFacturado).toBe(150)
  })

  it('sin ninguna venta en el período, factura 0 sin romper', async () => {
    const stats = await getAdminDashboardStats('day')
    expect(stats).toMatchObject({ totalFacturado: 0, cantidadVentas: 0 })
  })

  it('clientesNuevos cuenta por fecha de alta, ignora clientes viejos', async () => {
    await prisma.customer.create({ data: { name: 'Nueva', phone: '1111111111' } })
    await prisma.customer.create({ data: { name: 'Vieja', phone: '2222222222', createdAt: OLD } })
    const stats = await getAdminDashboardStats('day')
    expect(stats.clientesNuevos).toBe(1)
  })

  it('ventasAnuladas cuenta por fecha de anulación, no por fecha de creación de la venta', async () => {
    // Dos ventas "viejas al crearse, anuladas ahora": si el código filtrara por
    // createdAt en vez de por cancelledAt, ninguna de las dos contaría (el
    // conteo sería 0, no 2) — el conteo mismo discrimina la implementación
    // correcta, no solo cuál venta específica queda contada.
    await makeSale({ createdAt: OLD, cancelledAt: new Date() })
    await makeSale({ createdAt: OLD, cancelledAt: new Date() })
    // Señuelo: creada ahora pero anulada hace mucho — si el código filtrara
    // por createdAt (en vez de cancelledAt) la contaría, subiendo el total a 3.
    await makeSale({ cancelledAt: OLD })
    const stats = await getAdminDashboardStats('month')
    expect(stats.ventasAnuladas).toBe(2)
  })

  it('stockBajo devuelve solo variantes en o debajo del umbral, ordenadas ascendente', async () => {
    const p2 = await prisma.product.create({
      data: {
        name: 'Silla', categoryId, defaultPrice: 50,
        variants: { create: [{ name: 'Roja', price: 50 }, { name: 'Azul', price: 50 }, { name: 'Verde', price: 50 }] },
      },
      include: { variants: true },
    })
    const byName = Object.fromEntries(p2.variants.map((v) => [v.name, v.id]))
    await prisma.inventoryStock.create({ data: { variantId: v1, quantity: 10 } }) // por encima del umbral, no aparece
    await prisma.inventoryStock.create({ data: { variantId: byName['Roja'], quantity: LOW_STOCK_THRESHOLD } }) // justo en el umbral
    await prisma.inventoryStock.create({ data: { variantId: byName['Azul'], quantity: 0 } })
    await prisma.inventoryStock.create({ data: { variantId: byName['Verde'], quantity: 1 } })

    const stats = await getAdminDashboardStats('day')
    expect(stats.stockBajo.map((v) => v.quantity)).toEqual([0, 1, LOW_STOCK_THRESHOLD])
    expect(stats.stockBajo[0]).toMatchObject({ productName: 'Silla', variantName: 'Azul', quantity: 0 })
  })

  it('stockBajo incluye variantes sin fila de InventoryStock, tratándolas como 0', async () => {
    const p2 = await prisma.product.create({
      data: { name: 'Silla', categoryId, defaultPrice: 50, variants: { create: [{ name: 'SinStock', price: 50 }] } },
      include: { variants: true },
    })
    // Ni v1 (del beforeEach) ni la variante nueva tienen fila de InventoryStock
    // en este test — ambas deben aparecer con quantity: 0.
    const stats = await getAdminDashboardStats('day')
    const names = stats.stockBajo.map((v) => v.variantName).sort()
    expect(names).toEqual(['A', 'SinStock'])
    expect(stats.stockBajo.every((v) => v.quantity === 0)).toBe(true)
  })

  it('stockBajo no depende del período elegido', async () => {
    await prisma.inventoryStock.create({ data: { variantId: v1, quantity: 1 } })
    const day = await getAdminDashboardStats('day')
    const month = await getAdminDashboardStats('month')
    expect(day.stockBajo).toEqual(month.stockBajo)
  })
})

describe('getVendedorDashboardStats', () => {
  it('cuenta solo las ventas no anuladas de esa vendedora en el período', async () => {
    const otroId = (await prisma.user.create({ data: { email: 'b@b.com', name: 'Bruno', passwordHash: 'x', role: 'VENDEDOR' } })).id
    await makeSale()
    await makeSale()
    await makeSale({ cancelledAt: new Date() }) // anulada, no cuenta
    await makeSale({ createdAt: OLD }) // vieja, no cuenta
    await makeSale({ userId: otroId }) // de otra persona, no cuenta

    const stats = await getVendedorDashboardStats(userId, 'month')
    expect(stats.cantidadPedidos).toBe(2)
  })

  it('sin ninguna venta, devuelve 0 sin romper', async () => {
    const stats = await getVendedorDashboardStats(userId, 'day')
    expect(stats).toEqual({ cantidadPedidos: 0 })
  })
})
