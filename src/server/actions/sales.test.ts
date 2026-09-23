import { describe, expect, it, beforeEach, vi } from 'vitest'
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/server/auth/guards', () => ({
  requireRole: vi.fn().mockResolvedValue({ sub: 'USER_ID', role: 'VENDEDOR', name: 'Ana' }),
}))
import { prisma, resetDb } from '@/test/db'
import { createSale } from './sales'

let userId: string, v1: string, v2: string, v3: string

beforeEach(async () => {
  await resetDb()
  userId = (await prisma.user.create({ data: { email: 'a@a.com', name: 'Ana', passwordHash: 'x', role: 'VENDEDOR' } })).id
  vi.mocked((await import('@/server/auth/guards')).requireRole).mockResolvedValue({ sub: userId, role: 'VENDEDOR', name: 'Ana', mustChangePassword: false })
  const c = await prisma.category.create({ data: { name: 'Mesas', slug: 'mesas' } })
  const p = await prisma.product.create({
    data: {
      name: 'Mesa', categoryId: c.id, defaultPrice: 100,
      variants: { create: [{ name: 'A', price: 100 }, { name: 'B', price: 50 }, { name: 'Sin precio' }] },
    },
    include: { variants: true },
  })
  v1 = p.variants[0].id; v2 = p.variants[1].id; v3 = p.variants[2].id
  // v3 ("Sin precio") no tiene price propio; anular defaultPrice del producto
  // hace que su precio efectivo sea null sin afectar a v1/v2 (tienen price propio).
  await prisma.product.update({ where: { id: p.id }, data: { defaultPrice: null } })
  await prisma.inventoryStock.create({ data: { variantId: v1, quantity: 5 } })
  await prisma.inventoryStock.create({ data: { variantId: v2, quantity: 2 } })
})

describe('createSale', () => {
  it('descuenta stock, crea la venta y el movimiento VENTA vinculado por batchId', async () => {
    const res = await createSale({ items: [{ variantId: v1, quantity: 2 }], paymentMethod: 'EFECTIVO' })
    expect(res).toMatchObject({ ok: true, number: expect.any(Number) })
    const saleId = (res as { ok: true; saleId: string }).saleId

    expect(await prisma.inventoryStock.findUniqueOrThrow({ where: { variantId: v1 } })).toMatchObject({ quantity: 3 })
    const t = await prisma.inventoryTransaction.findFirstOrThrow({ where: { variantId: v1, type: 'VENTA' } })
    expect(t).toMatchObject({ quantityDelta: -2, quantityAfter: 3, userId, batchId: saleId })

    const sale = await prisma.sale.findUniqueOrThrow({ where: { id: saleId }, include: { items: true } })
    expect(sale).toMatchObject({ userId, paymentMethod: 'EFECTIVO' })
    expect(Number(sale.total)).toBe(200)
    expect(sale.items).toHaveLength(1)
    expect(sale.items[0]).toMatchObject({ variantId: v1, quantity: 2 })
    expect(Number(sale.items[0].unitPrice)).toBe(100)
    expect(Number(sale.items[0].subtotal)).toBe(200)
  })

  it('vende varios ítems y suma el total', async () => {
    const res = await createSale({
      items: [{ variantId: v1, quantity: 1 }, { variantId: v2, quantity: 2 }],
      paymentMethod: 'TARJETA',
    })
    expect(res.ok).toBe(true)
    const saleId = (res as { ok: true; saleId: string }).saleId
    const sale = await prisma.sale.findUniqueOrThrow({ where: { id: saleId } })
    expect(Number(sale.total)).toBe(200) // 1*100 + 2*50
  })

  it('fusiona líneas repetidas de la misma variante antes de validar stock', async () => {
    // v2 tiene 2 de stock; dos líneas de 1 cada una deben fusionarse en 2, no evaluarse por separado contra el stock original
    const res = await createSale({
      items: [{ variantId: v2, quantity: 1 }, { variantId: v2, quantity: 1 }],
      paymentMethod: 'EFECTIVO',
    })
    expect(res.ok).toBe(true)
    expect(await prisma.inventoryStock.findUniqueOrThrow({ where: { variantId: v2 } })).toMatchObject({ quantity: 0 })
  })

  it('rechaza si no hay stock suficiente y no persiste nada', async () => {
    const res = await createSale({ items: [{ variantId: v1, quantity: 99 }], paymentMethod: 'EFECTIVO' })
    expect(res).toMatchObject({ ok: false, error: expect.stringContaining('No hay stock suficiente') })
    expect(await prisma.sale.count()).toBe(0)
    expect(await prisma.inventoryStock.findUniqueOrThrow({ where: { variantId: v1 } })).toMatchObject({ quantity: 5 })
  })

  it('si un ítem no alcanza, no persiste ninguno de los otros ítems válidos', async () => {
    const res = await createSale({
      items: [{ variantId: v1, quantity: 1 }, { variantId: v2, quantity: 99 }],
      paymentMethod: 'EFECTIVO',
    })
    expect(res.ok).toBe(false)
    expect(await prisma.sale.count()).toBe(0)
    expect(await prisma.inventoryStock.findUniqueOrThrow({ where: { variantId: v1 } })).toMatchObject({ quantity: 5 })
  })

  it('rechaza vender un producto sin precio cargado', async () => {
    await prisma.inventoryStock.create({ data: { variantId: v3, quantity: 10 } })
    const res = await createSale({ items: [{ variantId: v3, quantity: 1 }], paymentMethod: 'EFECTIVO' })
    expect(res).toMatchObject({ ok: false, error: expect.stringContaining('no tiene precio cargado') })
    expect(await prisma.sale.count()).toBe(0)
  })

  it('rechaza un carrito vacío', async () => {
    const res = await createSale({ items: [], paymentMethod: 'EFECTIVO' })
    expect(res).toEqual({ ok: false, error: 'Agregá al menos un producto' })
  })

  it('rechaza sin método de pago', async () => {
    const res = await createSale({ items: [{ variantId: v1, quantity: 1 }] })
    expect(res).toEqual({ ok: false, error: 'Elegí un método de pago' })
  })
})

import { cancelSale } from './sales'

describe('cancelSale', () => {
  it('repone el stock y registra un movimiento ANULACION', async () => {
    const created = await createSale({ items: [{ variantId: v1, quantity: 2 }], paymentMethod: 'EFECTIVO' })
    const saleId = (created as { ok: true; saleId: string }).saleId

    const res = await cancelSale(saleId)
    expect(res).toEqual({ ok: true })

    expect(await prisma.inventoryStock.findUniqueOrThrow({ where: { variantId: v1 } })).toMatchObject({ quantity: 5 })
    const t = await prisma.inventoryTransaction.findFirstOrThrow({ where: { variantId: v1, type: 'ANULACION' } })
    expect(t).toMatchObject({ quantityDelta: 2, quantityAfter: 5, batchId: saleId })

    const sale = await prisma.sale.findUniqueOrThrow({ where: { id: saleId } })
    expect(sale.cancelledAt).not.toBeNull()
    expect(sale.cancelledById).toBe(userId)
  })

  it('rechaza anular una venta ya anulada', async () => {
    const created = await createSale({ items: [{ variantId: v1, quantity: 1 }], paymentMethod: 'EFECTIVO' })
    const saleId = (created as { ok: true; saleId: string }).saleId
    await cancelSale(saleId)
    expect(await cancelSale(saleId)).toEqual({ ok: false, error: 'Esta venta ya fue anulada' })
  })

  it('rechaza un id inexistente', async () => {
    expect(await cancelSale('00000000-0000-0000-0000-000000000000'))
      .toEqual({ ok: false, error: 'Venta no encontrada' })
  })
})
