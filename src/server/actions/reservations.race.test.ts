import { describe, expect, it, beforeEach, vi } from 'vitest'
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/server/auth/guards', () => ({
  requireRole: vi.fn().mockResolvedValue({ sub: 'U', role: 'VENDEDOR', name: 'Ana', mustChangePassword: false }),
}))
vi.mock('@/server/cloudinary', () => ({ deleteImages: vi.fn() }))
import { prisma, resetDb } from '@/test/db'
import { requireRole } from '@/server/auth/guards'
import { expireOverdueReservations } from '@/server/reservations/expiry'
import { addDeposit, addRefund, cancelReservation, convertReservation, resolveDeposit } from './reservations'
import { deleteProduct } from './products'
import { deleteVariant } from './variants'

let ana: string, mesa: string, silla: string, productId: string

async function reserva(
  status: 'LISTA' | 'VENCIDA' | 'ESPERANDO',
  deposits: { kind?: 'SENA' | 'DEVOLUCION'; amount: number }[] = [],
  extra: Record<string, unknown> = {},
) {
  return prisma.reservation.create({
    data: {
      userId: ana, status, ...extra,
      items: { create: [{ variantId: mesa, quantity: 1, allocated: status === 'VENCIDA' ? 0 : 1, unitPrice: 500 }] },
      payments: { create: deposits.map((d) => ({ kind: d.kind ?? 'SENA', amount: d.amount, paymentMethod: 'EFECTIVO' as const, userId: ana })) },
    },
  })
}
const devoluciones = (id: string) => prisma.reservationPayment.count({ where: { reservationId: id, kind: 'DEVOLUCION' } })

beforeEach(async () => {
  await resetDb()
  ana = (await prisma.user.create({ data: { email: 'a@a.com', passwordHash: 'x', name: 'Ana', role: 'VENDEDOR' } })).id
  vi.mocked(requireRole).mockResolvedValue({ sub: ana, role: 'VENDEDOR', name: 'Ana', mustChangePassword: false })
  const c = await prisma.category.create({ data: { name: 'Mesas', slug: 'mesas' } })
  const p = await prisma.product.create({
    data: { name: 'Juego', categoryId: c.id, variants: { create: [{ name: 'Mesa', price: 500 }, { name: 'Silla verde', price: 80 }] } },
    include: { variants: true },
  })
  productId = p.id
  mesa = p.variants.find((v) => v.name === 'Mesa')!.id
  silla = p.variants.find((v) => v.name === 'Silla verde')!.id
  await prisma.inventoryStock.create({ data: { variantId: mesa, quantity: 1 } })
})

describe('transiciones simultáneas', () => {
  it('dos cancelaciones a la vez devolviendo la seña crean una sola DEVOLUCION', async () => {
    const r = await reserva('LISTA', [{ amount: 300 }])
    const input = { id: r.id, deposit: { action: 'DEVOLVER' as const, paymentMethod: 'EFECTIVO' as const } }
    const [a, b] = await Promise.all([cancelReservation(input), cancelReservation(input)])
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1)
    expect(await devoluciones(r.id)).toBe(1)
  })

  it('dos resolveDeposit a la vez crean una sola DEVOLUCION', async () => {
    const r = await reserva('VENCIDA', [{ amount: 300 }])
    const input = { id: r.id, deposit: { action: 'DEVOLVER' as const, paymentMethod: 'EFECTIVO' as const } }
    const [a, b] = await Promise.all([resolveDeposit(input), resolveDeposit(input)])
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1)
    expect(await devoluciones(r.id)).toBe(1)
  })

  it('cancelar y concretar a la vez: gana una sola, nunca una venta con la reserva cancelada', async () => {
    const r = await reserva('LISTA', [{ amount: 300 }])
    const [c, v] = await Promise.all([
      cancelReservation({ id: r.id, deposit: { action: 'DEVOLVER', paymentMethod: 'EFECTIVO' } }),
      convertReservation({ id: r.id, paymentMethod: 'EFECTIVO' }),
    ])
    expect([c.ok, v.ok].filter(Boolean)).toHaveLength(1)
    const after = await prisma.reservation.findUniqueOrThrow({ where: { id: r.id } })
    expect(after.status === 'CONCRETADA').toBe(v.ok)
    expect(await prisma.sale.count()).toBe(v.ok ? 1 : 0)
    expect(await devoluciones(r.id)).toBe(c.ok ? 1 : 0)
  })

  it('el vencimiento no pisa una reserva que se concretó a la vez', async () => {
    await prisma.storeSettings.create({ data: { id: 1, reservationExpiryEnabled: true, reservationExpiryDays: 1 } })
    const r = await reserva('LISTA', [{ amount: 300 }], { readyAt: new Date('2026-01-01') })
    const [v] = await Promise.all([convertReservation({ id: r.id, paymentMethod: 'EFECTIVO' }), expireOverdueReservations()])
    const after = await prisma.reservation.findUniqueOrThrow({ where: { id: r.id } })
    if (v.ok) expect(after.status).toBe('CONCRETADA')
    expect(after.status === 'VENCIDA' && after.saleId !== null).toBe(false)
  })
})

describe('seña mayor al total', () => {
  it('addDeposit rechaza una seña que dejaría la seña neta por encima del total', async () => {
    const r = await reserva('LISTA', [{ amount: 400 }])
    const res = await addDeposit({ reservationId: r.id, amount: 200, paymentMethod: 'EFECTIVO' })
    expect(res).toMatchObject({ ok: false, error: expect.stringMatching(/supera el total/) })
    expect(await addDeposit({ reservationId: r.id, amount: 100, paymentMethod: 'EFECTIVO' })).toEqual({ ok: true })
  })

  it('addRefund registra una devolución parcial en una reserva abierta y permite concretar', async () => {
    const r = await reserva('LISTA', [{ amount: 700 }])
    expect((await convertReservation({ id: r.id, paymentMethod: 'EFECTIVO' })).ok).toBe(false)
    expect(await addRefund({ reservationId: r.id, amount: 300, paymentMethod: 'TRANSFERENCIA' })).toEqual({ ok: true })
    const p = await prisma.reservationPayment.findFirstOrThrow({ where: { reservationId: r.id, kind: 'DEVOLUCION' } })
    expect(Number(p.amount)).toBe(300)
    expect(p.paymentMethod).toBe('TRANSFERENCIA')
    expect((await convertReservation({ id: r.id, paymentMethod: 'EFECTIVO' })).ok).toBe(true)
  })

  it('addRefund no devuelve más de la seña neta ni en reservas cerradas', async () => {
    const r = await reserva('LISTA', [{ amount: 300 }])
    expect((await addRefund({ reservationId: r.id, amount: 400, paymentMethod: 'EFECTIVO' })).ok).toBe(false)
    const cerrada = await reserva('VENCIDA', [{ amount: 300 }])
    expect((await addRefund({ reservationId: cerrada.id, amount: 100, paymentMethod: 'EFECTIVO' })).ok).toBe(false)
    expect(await devoluciones(r.id)).toBe(0)
  })
})

describe('borrar productos con reservas', () => {
  it('deleteVariant rechaza una variante que tiene reservas', async () => {
    await prisma.inventoryStock.update({ where: { variantId: mesa }, data: { quantity: 0 } })
    await reserva('ESPERANDO')
    const res = await deleteVariant(mesa)
    expect(res).toMatchObject({ ok: false, error: expect.stringMatching(/reservas/) })
    expect(await prisma.productVariant.findUnique({ where: { id: mesa } })).not.toBeNull()
  })

  it('deleteProduct rechaza un producto con reservas y no toca sus imágenes', async () => {
    await prisma.inventoryStock.update({ where: { variantId: mesa }, data: { quantity: 0 } })
    await reserva('ESPERANDO')
    await prisma.productImage.create({ data: { productId, url: 'https://x/y.jpg', pathname: 'y', order: 0 } })
    const res = await deleteProduct(productId)
    expect(res).toMatchObject({ ok: false, error: expect.stringMatching(/reservas/) })
    expect(await prisma.productImage.count({ where: { productId } })).toBe(1)
    const { deleteImages } = await import('@/server/cloudinary')
    expect(vi.mocked(deleteImages)).not.toHaveBeenCalled()
  })
})
