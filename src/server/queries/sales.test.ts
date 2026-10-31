import { describe, expect, it, beforeEach } from 'vitest'
import { prisma, resetDb } from '@/test/db'
import { searchSellableVariants, listSales, getSale } from './sales'

let userId: string, v1: string, v2: string

beforeEach(async () => {
  await resetDb()
  userId = (await prisma.user.create({ data: { email: 'a@a.com', name: 'Ana', passwordHash: 'x', role: 'VENDEDOR' } })).id
  const c = await prisma.category.create({ data: { name: 'Sillones', slug: 'sillones' } })
  const p = await prisma.product.create({
    data: {
      name: 'Sillón Milán', categoryId: c.id, defaultPrice: 250,
      variants: { create: [{ name: '2 cuerpos', price: 300 }, { name: '3 cuerpos' }] },
    },
    include: { variants: true },
  })
  v1 = p.variants[0].id
  v2 = p.variants[1].id
  await prisma.inventoryStock.create({ data: { variantId: v1, quantity: 5 } })
})

describe('searchSellableVariants', () => {
  it('devuelve stock y precio efectivo', async () => {
    const results = await searchSellableVariants('milán')
    const r1 = results.find((r) => r.variantName === '2 cuerpos')!
    expect(r1).toMatchObject({ quantity: 5, unitPrice: 300 })
    const r2 = results.find((r) => r.variantName === '3 cuerpos')!
    expect(r2).toMatchObject({ quantity: 0, unitPrice: 250 })
  })
  it('ignora consultas de menos de 2 caracteres', async () => {
    expect(await searchSellableVariants('m')).toEqual([])
  })
})

describe('listSales y getSale', () => {
  it('lista y trae el detalle de una venta', async () => {
    const sale = await prisma.sale.create({
      data: {
        userId, paymentMethod: 'EFECTIVO', total: 300,
        items: { create: [{ variantId: v1, quantity: 1, unitPrice: 300, subtotal: 300 }] },
      },
    })
    const { rows, total } = await listSales()
    expect(total).toBe(1)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ number: sale.number, userName: 'Ana', paymentMethod: 'EFECTIVO', total: 300, cancelledAt: null })

    const detail = await getSale(sale.id)
    expect(detail).toMatchObject({ number: sale.number, userName: 'Ana', total: 300 })
    expect(detail!.items).toEqual([
      { variantId: v1, productName: 'Sillón Milán', variantName: '2 cuerpos', quantity: 1, unitPrice: 300, subtotal: 300 },
    ])
  })
  it('listSales pagina y devuelve el total', async () => {
    for (let i = 0; i < 3; i++) {
      await prisma.sale.create({
        data: { userId, paymentMethod: 'EFECTIVO', total: 10, items: { create: [{ variantId: v1, quantity: 1, unitPrice: 10, subtotal: 10 }] } },
      })
    }
    const p1 = await listSales({ page: 1, pageSize: 2 })
    const p2 = await listSales({ page: 2, pageSize: 2 })
    expect(p1.total).toBe(3)
    expect(p1.rows).toHaveLength(2)
    expect(p2.rows).toHaveLength(1)
  })
  it('listSales y getSale con userId solo devuelven las ventas de ese usuario', async () => {
    const other = await prisma.user.create({
      data: { name: 'Bea', email: 'bea@test.com', passwordHash: 'x', role: 'VENDEDOR' },
    })
    const mine = await prisma.sale.create({
      data: { userId, paymentMethod: 'EFECTIVO', total: 10, items: { create: [{ variantId: v1, quantity: 1, unitPrice: 10, subtotal: 10 }] } },
    })
    const theirs = await prisma.sale.create({
      data: { userId: other.id, paymentMethod: 'EFECTIVO', total: 20, items: { create: [{ variantId: v1, quantity: 1, unitPrice: 20, subtotal: 20 }] } },
    })
    const list = await listSales({ userId })
    expect(list.total).toBe(1)
    expect(list.rows.map((r) => r.id)).toEqual([mine.id])
    expect(await getSale(theirs.id, { userId })).toBeNull()
    expect(await getSale(mine.id, { userId })).not.toBeNull()
    expect(await getSale(theirs.id)).not.toBeNull()
  })
  it('getSale devuelve null para un id inexistente', async () => {
    expect(await getSale('00000000-0000-0000-0000-000000000000')).toBeNull()
  })
})

describe('getSale — dirección de envío', () => {
  it('devuelve la dirección guardada y null cuando no hay', async () => {
    const withAddress = await prisma.sale.create({
      data: { userId, paymentMethod: 'EFECTIVO', total: 10, shippingAddress: 'Av. Siempreviva 742',
        items: { create: [{ variantId: v1, quantity: 1, unitPrice: 10, subtotal: 10 }] } },
    })
    const without = await prisma.sale.create({
      data: { userId, paymentMethod: 'EFECTIVO', total: 10,
        items: { create: [{ variantId: v1, quantity: 1, unitPrice: 10, subtotal: 10 }] } },
    })
    expect((await getSale(withAddress.id))?.shippingAddress).toBe('Av. Siempreviva 742')
    expect((await getSale(without.id))?.shippingAddress).toBeNull()
  })
})

describe('searchSellableVariants con reservas', () => {
  it('quantity es el disponible: stock menos lo apartado', async () => {
    await prisma.reservation.create({
      data: { userId, status: 'LISTA', items: { create: [{ variantId: v1, quantity: 2, allocated: 2, unitPrice: 300 }] } },
    })
    const r = (await searchSellableVariants('milán')).find((x) => x.variantName === '2 cuerpos')!
    expect(r.quantity).toBe(3)
  })
})

describe('getSale con seña', () => {
  it('devuelve depositApplied', async () => {
    const sale = await prisma.sale.create({
      data: { userId, paymentMethod: 'EFECTIVO', total: 300, depositApplied: 100, items: { create: [{ variantId: v1, quantity: 1, unitPrice: 300, subtotal: 300 }] } },
    })
    expect((await getSale(sale.id))!.depositApplied).toBe(100)
    const sinSena = await prisma.sale.create({
      data: { userId, paymentMethod: 'EFECTIVO', total: 300, items: { create: [{ variantId: v1, quantity: 1, unitPrice: 300, subtotal: 300 }] } },
    })
    expect((await getSale(sinSena.id))!.depositApplied).toBe(0)
  })
})

describe('getSale con descuento', () => {
  it('devuelve discount y discountReason', async () => {
    const sale = await prisma.sale.create({
      data: { userId, paymentMethod: 'EFECTIVO', total: 270, discount: 30, discountReason: 'mancha', items: { create: [{ variantId: v1, quantity: 1, unitPrice: 300, subtotal: 300 }] } },
    })
    expect(await getSale(sale.id)).toMatchObject({ discount: 30, discountReason: 'mancha', total: 270 })
  })
})

describe('getSale con localidad y clienta', () => {
  it('devuelve la localidad y el nombre de la clienta asociada', async () => {
    const customer = await prisma.customer.create({ data: { name: 'Luna Paz', phone: '1123456789' } })
    const sale = await prisma.sale.create({
      data: { userId, paymentMethod: 'EFECTIVO', total: 300, shippingCity: 'Merlo', customerId: customer.id, items: { create: [{ variantId: v1, quantity: 1, unitPrice: 300, subtotal: 300 }] } },
    })
    expect(await getSale(sale.id)).toMatchObject({ shippingCity: 'Merlo', customerName: 'Luna Paz' })
  })

  it('sin clienta ni localidad devuelve null', async () => {
    const sale = await prisma.sale.create({
      data: { userId, paymentMethod: 'EFECTIVO', total: 300, items: { create: [{ variantId: v1, quantity: 1, unitPrice: 300, subtotal: 300 }] } },
    })
    expect(await getSale(sale.id)).toMatchObject({ shippingCity: null, customerName: null })
  })
})
