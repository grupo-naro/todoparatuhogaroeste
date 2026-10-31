import { describe, expect, it, beforeEach, vi } from 'vitest'
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/server/auth/guards', () => ({
  requireRole: vi.fn().mockResolvedValue({ sub: 'U', role: 'VENDEDOR', name: 'Ana', mustChangePassword: false }),
}))
import { prisma, resetDb } from '@/test/db'
import { requireRole } from '@/server/auth/guards'
import { addDeposit, createReservation, markReservationNotified } from './reservations'

let ana: string, bea: string, mesa: string, silla: string, sinPrecio: string

const asUser = (id: string, role: 'VENDEDOR' | 'ADMIN' = 'VENDEDOR') =>
  vi.mocked(requireRole).mockResolvedValue({ sub: id, role, name: 'X', mustChangePassword: false })
const stockOf = async (variantId: string) => (await prisma.inventoryStock.findUnique({ where: { variantId } }))?.quantity ?? 0

beforeEach(async () => {
  await resetDb()
  ana = (await prisma.user.create({ data: { email: 'a@a.com', passwordHash: 'x', name: 'Ana', role: 'VENDEDOR' } })).id
  bea = (await prisma.user.create({ data: { email: 'b@b.com', passwordHash: 'x', name: 'Bea', role: 'VENDEDOR' } })).id
  asUser(ana)
  const c = await prisma.category.create({ data: { name: 'Mesas', slug: 'mesas' } })
  const p = await prisma.product.create({
    data: { name: 'Juego', categoryId: c.id, variants: { create: [{ name: 'Mesa', price: 500 }, { name: 'Silla verde', price: 80 }, { name: 'Sin precio' }] } },
    include: { variants: true },
  })
  mesa = p.variants.find((v) => v.name === 'Mesa')!.id
  silla = p.variants.find((v) => v.name === 'Silla verde')!.id
  sinPrecio = p.variants.find((v) => v.name === 'Sin precio')!.id
  await prisma.inventoryStock.create({ data: { variantId: mesa, quantity: 1 } })
})

describe('createReservation', () => {
  it('aparta lo que hay y deja esperando lo que falta', async () => {
    const res = await createReservation({ items: [{ variantId: mesa, quantity: 1 }, { variantId: silla, quantity: 6 }] })
    expect(res).toMatchObject({ ok: true, number: expect.any(Number) })
    const r = await prisma.reservation.findUniqueOrThrow({ where: { id: (res as { reservationId: string }).reservationId }, include: { items: true } })
    expect(r.status).toBe('ESPERANDO')
    expect(r.userId).toBe(ana)
    expect(r.items.find((i) => i.variantId === mesa)!.allocated).toBe(1)
    expect(r.items.find((i) => i.variantId === silla)!.allocated).toBe(0)
    expect(Number(r.items.find((i) => i.variantId === silla)!.unitPrice)).toBe(80)
  })

  it('sin faltantes nace LISTA con readyAt', async () => {
    const res = await createReservation({ items: [{ variantId: mesa, quantity: 1 }] })
    const r = await prisma.reservation.findUniqueOrThrow({ where: { id: (res as { reservationId: string }).reservationId } })
    expect(r.status).toBe('LISTA')
    expect(r.readyAt).not.toBeNull()
  })

  it('una reserva de un producto sin stock no toca el stock del depósito', async () => {
    await createReservation({ items: [{ variantId: silla, quantity: 2 }] })
    expect(await stockOf(silla)).toBe(0)
    await createReservation({ items: [{ variantId: mesa, quantity: 1 }] })
    expect(await stockOf(mesa)).toBe(1)
  })

  it('con seña crea un pago SENA; sin seña no crea pagos', async () => {
    await createReservation({ items: [{ variantId: silla, quantity: 1 }], deposit: { amount: 200, paymentMethod: 'TRANSFERENCIA' } })
    const p = await prisma.reservationPayment.findFirstOrThrow()
    expect(p).toMatchObject({ kind: 'SENA', paymentMethod: 'TRANSFERENCIA', userId: ana })
    expect(Number(p.amount)).toBe(200)
    await resetPayments()
    await createReservation({ items: [{ variantId: silla, quantity: 1 }] })
    expect(await prisma.reservationPayment.count()).toBe(0)
  })

  it('rechaza una línea sin precio y no crea nada', async () => {
    const res = await createReservation({ items: [{ variantId: mesa, quantity: 1 }, { variantId: sinPrecio, quantity: 1 }] })
    expect(res).toEqual({ ok: false, error: 'Juego · Sin precio no tiene precio cargado' })
    expect(await prisma.reservation.count()).toBe(0)
  })

  it('rechaza seña de 0 o negativa y cantidades inválidas', async () => {
    expect((await createReservation({ items: [{ variantId: silla, quantity: 1 }], deposit: { amount: 0, paymentMethod: 'EFECTIVO' } })).ok).toBe(false)
    expect((await createReservation({ items: [{ variantId: silla, quantity: 1 }], deposit: { amount: -5, paymentMethod: 'EFECTIVO' } })).ok).toBe(false)
    expect((await createReservation({ items: [{ variantId: silla, quantity: 0 }] })).ok).toBe(false)
    expect(await prisma.reservation.count()).toBe(0)
  })

  it('fusiona líneas repetidas de la misma variante', async () => {
    const res = await createReservation({ items: [{ variantId: silla, quantity: 2 }, { variantId: silla, quantity: 3 }] })
    const items = await prisma.reservationItem.findMany({ where: { reservationId: (res as { reservationId: string }).reservationId } })
    expect(items).toHaveLength(1)
    expect(items[0].quantity).toBe(5)
  })

  it('dos reservas por la última unidad: la segunda queda esperando', async () => {
    const a = await createReservation({ items: [{ variantId: mesa, quantity: 1 }] })
    const b = await createReservation({ items: [{ variantId: mesa, quantity: 1 }] })
    const ia = await prisma.reservationItem.findFirstOrThrow({ where: { reservationId: (a as { reservationId: string }).reservationId } })
    const ib = await prisma.reservationItem.findFirstOrThrow({ where: { reservationId: (b as { reservationId: string }).reservationId } })
    expect([ia.allocated, ib.allocated]).toEqual([1, 0])
  })

  it('asocia a la clienta por teléfono y guarda su nombre y teléfono', async () => {
    const res = await createReservation({ items: [{ variantId: silla, quantity: 1 }], customerPhone: '11 2345-6789', customerName: 'Luna Paz', shippingAddress: 'Calle 1', note: 'terciopelo' })
    const r = await prisma.reservation.findUniqueOrThrow({ where: { id: (res as { reservationId: string }).reservationId } })
    expect(r).toMatchObject({ customerName: 'Luna Paz', customerPhone: '1123456789', shippingAddress: 'Calle 1', note: 'terciopelo' })
    expect(r.customerId).not.toBeNull()
  })

  it('exige rol ADMIN o VENDEDOR', async () => {
    await createReservation({ items: [{ variantId: silla, quantity: 1 }] })
    expect(vi.mocked(requireRole)).toHaveBeenCalledWith(['ADMIN', 'VENDEDOR'])
  })
})

async function resetPayments() {
  await prisma.reservationPayment.deleteMany()
}

describe('addDeposit / markReservationNotified', () => {
  async function reserva(status: 'ESPERANDO' | 'CANCELADA' = 'ESPERANDO') {
    return prisma.reservation.create({ data: { userId: ana, status, items: { create: [{ variantId: silla, quantity: 1, unitPrice: 80 }] } } })
  }

  it('registra una seña más en una reserva abierta', async () => {
    const r = await reserva()
    expect(await addDeposit({ reservationId: r.id, amount: 50, paymentMethod: 'EFECTIVO' })).toEqual({ ok: true })
    expect(await prisma.reservationPayment.count({ where: { reservationId: r.id } })).toBe(1)
  })

  it('rechaza en reservas cerradas', async () => {
    const r = await reserva('CANCELADA')
    expect((await addDeposit({ reservationId: r.id, amount: 100, paymentMethod: 'EFECTIVO' })).ok).toBe(false)
  })

  it('otra vendedora no puede, el admin sí', async () => {
    const r = await reserva()
    asUser(bea)
    expect(await addDeposit({ reservationId: r.id, amount: 100, paymentMethod: 'EFECTIVO' })).toEqual({ ok: false, error: 'Reserva no encontrada' })
    expect(await markReservationNotified(r.id)).toEqual({ ok: false, error: 'Reserva no encontrada' })
    asUser(bea, 'ADMIN')
    expect((await addDeposit({ reservationId: r.id, amount: 50, paymentMethod: 'EFECTIVO' })).ok).toBe(true)
  })

  it('marca a la clienta como avisada', async () => {
    const r = await reserva()
    expect(await markReservationNotified(r.id)).toEqual({ ok: true })
    expect((await prisma.reservation.findUniqueOrThrow({ where: { id: r.id } })).notifiedAt).not.toBeNull()
  })
})

describe('createReservation — impresión', () => {
  it('encola el comprobante de la clienta y la hoja de depósito', async () => {
    const res = await createReservation({ items: [{ variantId: silla, quantity: 1 }] })
    const jobs = await prisma.printJob.findMany()
    expect(jobs.map((j) => j.kind).sort()).toEqual(['RESERVA', 'RESERVA_DEPOSITO'])
    expect(jobs.every((j) => j.reservationId === (res as { reservationId: string }).reservationId)).toBe(true)
  })

  it('si la reserva falla no encola nada', async () => {
    await createReservation({ items: [{ variantId: sinPrecio, quantity: 1 }] })
    expect(await prisma.printJob.count()).toBe(0)
  })
})

describe('descuento en la reserva', () => {
  it('guarda el descuento y su motivo', async () => {
    const res = await createReservation({ items: [{ variantId: silla, quantity: 2 }], discount: 30, discountReason: 'sin caja' })
    const r = await prisma.reservation.findUniqueOrThrow({ where: { id: (res as { reservationId: string }).reservationId } })
    expect(Number(r.discount)).toBe(30)
    expect(r.discountReason).toBe('sin caja')
  })

  it('rechaza un descuento mayor al total y no crea nada', async () => {
    const res = await createReservation({ items: [{ variantId: silla, quantity: 1 }], discount: 81 })
    expect(res).toEqual({ ok: false, error: 'El descuento no puede superar el total' })
    expect(await prisma.reservation.count()).toBe(0)
    expect(await prisma.printJob.count()).toBe(0)
  })

  it('el límite de la seña se calcula sobre el total ya descontado', async () => {
    const res = await createReservation({ items: [{ variantId: silla, quantity: 1 }], discount: 30 })
    const reservationId = (res as { reservationId: string }).reservationId
    expect((await addDeposit({ reservationId, amount: 60, paymentMethod: 'EFECTIVO' })).ok).toBe(false)
    expect((await addDeposit({ reservationId, amount: 50, paymentMethod: 'EFECTIVO' })).ok).toBe(true)
  })
})

describe('localidad en la reserva', () => {
  it('guarda la localidad y la pasa a la venta al concretar', async () => {
    const res = await createReservation({ items: [{ variantId: mesa, quantity: 1 }], shippingAddress: 'Calle 1', shippingCity: ' Merlo ' })
    const r = await prisma.reservation.findUniqueOrThrow({ where: { id: (res as { reservationId: string }).reservationId } })
    expect(r.shippingCity).toBe('Merlo')
  })
})
