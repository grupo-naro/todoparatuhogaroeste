import { describe, expect, it, beforeEach } from 'vitest'
import { prisma, resetDb } from '@/test/db'
import { getCustomerByPhone, listCustomers } from './customers'

let userId: string, v1: string

beforeEach(async () => {
  await resetDb()
  userId = (await prisma.user.create({ data: { email: 'a@a.com', name: 'Ana', passwordHash: 'x', role: 'VENDEDOR' } })).id
  const c = await prisma.category.create({ data: { name: 'Mesas', slug: 'mesas' } })
  const p = await prisma.product.create({
    data: { name: 'Mesa', categoryId: c.id, defaultPrice: 100, variants: { create: [{ name: 'A', price: 100 }] } },
    include: { variants: true },
  })
  v1 = p.variants[0].id
})

describe('getCustomerByPhone', () => {
  it('encuentra normalizando el formato de búsqueda', async () => {
    await prisma.customer.create({ data: { name: 'Ana Gómez', phone: '1123456789' } })
    const found = await getCustomerByPhone('11 2345-6789')
    expect(found).toMatchObject({ name: 'Ana Gómez', phone: '1123456789' })
  })
  it('null si no existe', async () => {
    expect(await getCustomerByPhone('1199999999')).toBeNull()
  })
})

describe('listCustomers', () => {
  it('cuenta compras y suma el gasto solo de ventas no anuladas', async () => {
    const customer = await prisma.customer.create({ data: { name: 'Ana Gómez', phone: '1123456789' } })
    await prisma.sale.create({
      data: { userId, paymentMethod: 'EFECTIVO', total: 100, customerId: customer.id,
        items: { create: [{ variantId: v1, quantity: 1, unitPrice: 100, subtotal: 100 }] } },
    })
    const cancelled = await prisma.sale.create({
      data: { userId, paymentMethod: 'EFECTIVO', total: 100, customerId: customer.id, cancelledAt: new Date(),
        items: { create: [{ variantId: v1, quantity: 1, unitPrice: 100, subtotal: 100 }] } },
    })
    const rows = await listCustomers()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ name: 'Ana Gómez', phone: '1123456789', purchaseCount: 1, totalSpent: 100, isRecurring: false })
  })
  it('isRecurring en 2 compras no anuladas', async () => {
    const customer = await prisma.customer.create({ data: { name: 'Ana Gómez', phone: '1123456789' } })
    for (let i = 0; i < 2; i++) {
      await prisma.sale.create({
        data: { userId, paymentMethod: 'EFECTIVO', total: 50, customerId: customer.id,
          items: { create: [{ variantId: v1, quantity: 1, unitPrice: 50, subtotal: 50 }] } },
      })
    }
    const rows = await listCustomers()
    expect(rows[0]).toMatchObject({ purchaseCount: 2, totalSpent: 100, isRecurring: true })
  })
})
