import { describe, expect, it, beforeEach, vi } from 'vitest'
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/server/auth/guards', () => ({
  requireRole: vi.fn().mockResolvedValue({ sub: 'U', role: 'VENDEDOR', name: 'Ana', mustChangePassword: false }),
}))
import { prisma, resetDb } from '@/test/db'
import { requireRole } from '@/server/auth/guards'
import { cancelReservation, convertReservation, resolveDeposit } from './reservations'

let ana: string, mesa: string, silla: string

type Status = 'ESPERANDO' | 'LISTA' | 'VENCIDA' | 'CANCELADA' | 'CONCRETADA'
async function reserva(
  status: Status,
  items: { variantId: string; quantity: number; allocated: number; unitPrice?: number }[],
  deposits: { kind?: 'SENA' | 'DEVOLUCION'; amount: number }[] = [],
  extra: Record<string, unknown> = {},
) {
  return prisma.reservation.create({
    data: {
      userId: ana, status, customerName: 'Luna', shippingAddress: 'Calle 1',
      items: { create: items.map((i) => ({ unitPrice: 500, ...i })) },
      payments: { create: deposits.map((d) => ({ kind: d.kind ?? 'SENA', amount: d.amount, paymentMethod: 'EFECTIVO' as const, userId: ana })) },
      ...extra,
    },
  })
}
const stock = async (variantId: string) => (await prisma.inventoryStock.findUniqueOrThrow({ where: { variantId } })).quantity
const state = (id: string) => prisma.reservation.findUniqueOrThrow({ where: { id }, include: { items: true, payments: true } })

beforeEach(async () => {
  await resetDb()
  ana = (await prisma.user.create({ data: { email: 'a@a.com', passwordHash: 'x', name: 'Ana', role: 'VENDEDOR' } })).id
  vi.mocked(requireRole).mockResolvedValue({ sub: ana, role: 'VENDEDOR', name: 'Ana', mustChangePassword: false })
  const c = await prisma.category.create({ data: { name: 'Mesas', slug: 'mesas' } })
  const p = await prisma.product.create({
    data: { name: 'Juego', categoryId: c.id, variants: { create: [{ name: 'Mesa', price: 500 }, { name: 'Silla verde', price: 80 }] } },
    include: { variants: true },
  })
  mesa = p.variants.find((v) => v.name === 'Mesa')!.id
  silla = p.variants.find((v) => v.name === 'Silla verde')!.id
  await prisma.inventoryStock.create({ data: { variantId: mesa, quantity: 1 } })
  await prisma.inventoryStock.create({ data: { variantId: silla, quantity: 6 } })
})

describe('cancelReservation', () => {
  it('cancelar sin seña no pide decisión y libera lo apartado', async () => {
    const r = await reserva('LISTA', [{ variantId: mesa, quantity: 1, allocated: 1 }])
    expect(await cancelReservation({ id: r.id })).toEqual({ ok: true })
    const s = await state(r.id)
    expect(s.status).toBe('CANCELADA')
    expect(s.closedAt).not.toBeNull()
    expect(s.items[0].allocated).toBe(0)
    expect(s.depositResolution).toBeNull()
  })

  it('con seña exige elegir devolver o retener', async () => {
    const r = await reserva('LISTA', [{ variantId: mesa, quantity: 1, allocated: 1 }], [{ amount: 200 }])
    const res = await cancelReservation({ id: r.id })
    expect(res.ok).toBe(false)
    expect((await state(r.id)).status).toBe('LISTA')
  })

  it('devolver crea una DEVOLUCION por el neto y deja la seña en 0', async () => {
    const r = await reserva('LISTA', [{ variantId: mesa, quantity: 1, allocated: 1 }], [{ amount: 300 }, { amount: 200 }, { kind: 'DEVOLUCION', amount: 100 }])
    expect(await cancelReservation({ id: r.id, deposit: { action: 'DEVOLVER', paymentMethod: 'TRANSFERENCIA' } })).toEqual({ ok: true })
    const s = await state(r.id)
    const dev = s.payments.filter((p) => p.kind === 'DEVOLUCION').sort((a, b) => Number(b.amount) - Number(a.amount))[0]
    expect(Number(dev.amount)).toBe(400)
    expect(dev.paymentMethod).toBe('TRANSFERENCIA')
    expect(s.depositResolution).toBe('DEVUELTA')
  })

  it('retener deja RETENIDA y los pagos intactos', async () => {
    const r = await reserva('LISTA', [{ variantId: mesa, quantity: 1, allocated: 1 }], [{ amount: 300 }])
    expect(await cancelReservation({ id: r.id, deposit: { action: 'RETENER' } })).toEqual({ ok: true })
    const s = await state(r.id)
    expect(s.depositResolution).toBe('RETENIDA')
    expect(s.payments).toHaveLength(1)
  })

  it('al cancelar, lo liberado se aparta a otra reserva que esperaba', async () => {
    const r = await reserva('LISTA', [{ variantId: mesa, quantity: 1, allocated: 1 }])
    const espera = await reserva('ESPERANDO', [{ variantId: mesa, quantity: 1, allocated: 0 }])
    await cancelReservation({ id: r.id })
    const s = await state(espera.id)
    expect(s.items[0].allocated).toBe(1)
    expect(s.status).toBe('LISTA')
  })

  it('no se puede cancelar una CONCRETADA ni la de otra vendedora', async () => {
    const r = await reserva('CONCRETADA', [{ variantId: mesa, quantity: 1, allocated: 0 }])
    expect((await cancelReservation({ id: r.id })).ok).toBe(false)
    const otra = await reserva('LISTA', [{ variantId: mesa, quantity: 1, allocated: 1 }])
    vi.mocked(requireRole).mockResolvedValue({ sub: '00000000-0000-0000-0000-000000000009', role: 'VENDEDOR', name: 'X', mustChangePassword: false })
    expect(await cancelReservation({ id: otra.id })).toEqual({ ok: false, error: 'Reserva no encontrada' })
  })
})

describe('resolveDeposit', () => {
  it('resuelve la seña de una VENCIDA sin resolver', async () => {
    const r = await reserva('VENCIDA', [{ variantId: mesa, quantity: 1, allocated: 0 }], [{ amount: 500 }])
    expect(await resolveDeposit({ id: r.id, deposit: { action: 'DEVOLVER', paymentMethod: 'EFECTIVO' } })).toEqual({ ok: true })
    const s = await state(r.id)
    expect(s.depositResolution).toBe('DEVUELTA')
    expect(s.payments.some((p) => p.kind === 'DEVOLUCION' && Number(p.amount) === 500)).toBe(true)
  })

  it('rechaza si la reserva está abierta o ya fue resuelta', async () => {
    const abierta = await reserva('LISTA', [{ variantId: mesa, quantity: 1, allocated: 1 }], [{ amount: 500 }])
    expect((await resolveDeposit({ id: abierta.id, deposit: { action: 'RETENER' } })).ok).toBe(false)
    const resuelta = await reserva('VENCIDA', [{ variantId: mesa, quantity: 1, allocated: 0 }], [{ amount: 500 }], { depositResolution: 'RETENIDA' })
    expect((await resolveDeposit({ id: resuelta.id, deposit: { action: 'RETENER' } })).ok).toBe(false)
  })
})

describe('convertReservation', () => {
  const lista = (deposits: { amount: number }[] = [], unitPrice = 500) =>
    reserva('LISTA', [{ variantId: mesa, quantity: 1, allocated: 1, unitPrice }, { variantId: silla, quantity: 2, allocated: 2, unitPrice: 80 }], deposits)

  it('descuenta el stock una sola vez y deja la reserva CONCRETADA con su venta', async () => {
    const r = await lista()
    const res = await convertReservation({ id: r.id, paymentMethod: 'EFECTIVO' })
    expect(res).toMatchObject({ ok: true, saleId: expect.any(String), number: expect.any(Number) })
    expect(await stock(mesa)).toBe(0)
    expect(await stock(silla)).toBe(4)
    const s = await state(r.id)
    expect(s.status).toBe('CONCRETADA')
    expect(s.saleId).toBe((res as { saleId: string }).saleId)
    expect(s.items.every((i) => i.allocated === 0)).toBe(true)
    const sale = await prisma.sale.findUniqueOrThrow({ where: { id: s.saleId! }, include: { items: true } })
    expect(Number(sale.total)).toBe(660)
    expect(sale.shippingAddress).toBe('Calle 1')
    expect(await prisma.inventoryTransaction.count({ where: { type: 'VENTA', batchId: sale.id } })).toBe(2)
    expect(await prisma.printJob.count({ where: { kind: 'VENTA', saleId: sale.id } })).toBe(1)
  })

  it('la venta resultante tiene depositApplied igual a la seña neta', async () => {
    const r = await lista([{ amount: 300 }, { amount: 100 }])
    const res = await convertReservation({ id: r.id, paymentMethod: 'TARJETA' })
    const sale = await prisma.sale.findUniqueOrThrow({ where: { id: (res as { saleId: string }).saleId } })
    expect(Number(sale.depositApplied)).toBe(400)
    expect(sale.paymentMethod).toBe('TARJETA')
  })

  it('rechaza si la reserva todavía está ESPERANDO', async () => {
    const r = await reserva('ESPERANDO', [{ variantId: silla, quantity: 8, allocated: 6 }])
    const res = await convertReservation({ id: r.id, paymentMethod: 'EFECTIVO' })
    expect(res.ok).toBe(false)
    expect(await prisma.sale.count()).toBe(0)
  })

  it('con precio cambiado y sin priceMode devuelve priceChanges y no toca nada', async () => {
    const r = await lista([], 400)
    const res = await convertReservation({ id: r.id, paymentMethod: 'EFECTIVO' })
    expect(res).toMatchObject({ ok: false, priceChanges: [{ productName: 'Juego', variantName: 'Mesa', reserved: 400, current: 500 }] })
    expect(await prisma.sale.count()).toBe(0)
    expect((await state(r.id)).status).toBe('LISTA')
    expect(await stock(mesa)).toBe(1)
  })

  it('priceMode RESERVA cobra el precio del día de la reserva, ACTUAL el actual', async () => {
    const a = await lista([], 400)
    const ra = await convertReservation({ id: a.id, paymentMethod: 'EFECTIVO', priceMode: 'RESERVA' })
    expect(Number((await prisma.sale.findUniqueOrThrow({ where: { id: (ra as { saleId: string }).saleId } })).total)).toBe(560)
    await prisma.inventoryStock.update({ where: { variantId: mesa }, data: { quantity: 1 } })
    await prisma.inventoryStock.update({ where: { variantId: silla }, data: { quantity: 6 } })
    const b = await lista([], 400)
    const rb = await convertReservation({ id: b.id, paymentMethod: 'EFECTIVO', priceMode: 'ACTUAL' })
    expect(Number((await prisma.sale.findUniqueOrThrow({ where: { id: (rb as { saleId: string }).saleId } })).total)).toBe(660)
  })

  it('rechaza una seña mayor al total', async () => {
    const r = await lista([{ amount: 700 }])
    const res = await convertReservation({ id: r.id, paymentMethod: 'EFECTIVO' })
    expect(res).toMatchObject({ ok: false, error: expect.stringMatching(/La seña supera el total/) })
    expect((await state(r.id)).status).toBe('LISTA')
    expect(await prisma.sale.count()).toBe(0)
  })

  it('convertir dos veces a la vez crea una sola venta', async () => {
    const r = await lista()
    const [a, b] = await Promise.all([
      convertReservation({ id: r.id, paymentMethod: 'EFECTIVO' }),
      convertReservation({ id: r.id, paymentMethod: 'EFECTIVO' }),
    ])
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1)
    expect(await prisma.sale.count()).toBe(1)
    expect(await stock(mesa)).toBe(0)
  })
})

describe('convertReservation con descuento', () => {
  const conDescuento = (discount: number, unitPrice = 500) =>
    reserva('LISTA', [{ variantId: mesa, quantity: 1, allocated: 1, unitPrice }, { variantId: silla, quantity: 2, allocated: 2, unitPrice: 80 }], [], { discount, discountReason: 'mancha' })

  it('la venta lleva el descuento y su total ya descontado', async () => {
    const r = await conDescuento(100)
    const res = await convertReservation({ id: r.id, paymentMethod: 'EFECTIVO' })
    const sale = await prisma.sale.findUniqueOrThrow({ where: { id: (res as { saleId: string }).saleId } })
    expect(Number(sale.total)).toBe(560)
    expect(Number(sale.discount)).toBe(100)
    expect(sale.discountReason).toBe('mancha')
  })

  it('con la seña, la seña se compara con el total descontado', async () => {
    const r = await reserva('LISTA', [{ variantId: mesa, quantity: 1, allocated: 1 }], [{ amount: 450 }], { discount: 100 })
    const res = await convertReservation({ id: r.id, paymentMethod: 'EFECTIVO' })
    expect(res).toMatchObject({ ok: false, error: expect.stringMatching(/La seña supera el total/) })
  })

  it('rechaza si el descuento supera el total con el precio elegido', async () => {
    const r = await conDescuento(600, 700)
    await prisma.productVariant.update({ where: { id: mesa }, data: { price: 100 } })
    await prisma.productVariant.update({ where: { id: silla }, data: { price: 100 } })
    const res = await convertReservation({ id: r.id, paymentMethod: 'EFECTIVO', priceMode: 'ACTUAL' })
    expect(res).toMatchObject({ ok: false, error: expect.stringMatching(/descuento/i) })
    expect(await prisma.sale.count()).toBe(0)
  })
})

describe('convertReservation — localidad', () => {
  it('la venta lleva la dirección, la localidad y la clienta de la reserva', async () => {
    const customer = await prisma.customer.create({ data: { name: 'Luna Paz', phone: '1123456789' } })
    const r = await reserva('LISTA', [{ variantId: mesa, quantity: 1, allocated: 1 }], [], { shippingCity: 'Merlo', customerId: customer.id })
    const res = await convertReservation({ id: r.id, paymentMethod: 'EFECTIVO' })
    const sale = await prisma.sale.findUniqueOrThrow({ where: { id: (res as { saleId: string }).saleId } })
    expect(sale).toMatchObject({ shippingAddress: 'Calle 1', shippingCity: 'Merlo', customerId: customer.id })
  })
})
