import { beforeEach, describe, expect, it } from 'vitest'
import { prisma, resetDb } from '@/test/db'
import { countReadyReservations, getReservation, listReservations, listUnresolvedDeposits } from './reservations'

let ana: string, bea: string, mesa: string, silla: string

type Status = 'ESPERANDO' | 'LISTA' | 'CONCRETADA' | 'CANCELADA' | 'VENCIDA'
const make = (userId: string, status: Status, items: { variantId: string; quantity: number; allocated: number }[], extra: Record<string, unknown> = {}) =>
  prisma.reservation.create({
    data: { userId, status, customerName: 'Clienta', items: { create: items.map((i) => ({ ...i, unitPrice: 100 })) }, ...extra },
  })
const pay = (reservationId: string, kind: 'SENA' | 'DEVOLUCION', amount: number) =>
  prisma.reservationPayment.create({ data: { reservationId, kind, amount, paymentMethod: 'EFECTIVO', userId: ana } })

beforeEach(async () => {
  await resetDb()
  ana = (await prisma.user.create({ data: { email: 'a@a.com', passwordHash: 'x', name: 'Ana', role: 'VENDEDOR' } })).id
  bea = (await prisma.user.create({ data: { email: 'b@b.com', passwordHash: 'x', name: 'Bea', role: 'VENDEDOR' } })).id
  const c = await prisma.category.create({ data: { name: 'Mesas', slug: 'mesas' } })
  const p = await prisma.product.create({
    data: { name: 'Juego', categoryId: c.id, defaultPrice: 120, variants: { create: [{ name: 'Mesa', price: 150 }, { name: 'Silla verde' }] } },
    include: { variants: true },
  })
  mesa = p.variants.find((v) => v.name === 'Mesa')!.id
  silla = p.variants.find((v) => v.name === 'Silla verde')!.id
})

describe('getReservation', () => {
  it('con userId de otra vendedora devuelve null', async () => {
    const r = await make(ana, 'LISTA', [{ variantId: mesa, quantity: 1, allocated: 1 }])
    expect(await getReservation(r.id, { userId: bea })).toBeNull()
    expect(await getReservation(r.id, { userId: ana })).not.toBeNull()
    expect(await getReservation(r.id)).not.toBeNull()
  })

  it('depositBalance resta devoluciones y trae precio de la reserva y precio actual', async () => {
    const r = await make(ana, 'ESPERANDO', [{ variantId: mesa, quantity: 1, allocated: 1 }, { variantId: silla, quantity: 2, allocated: 0 }])
    await pay(r.id, 'SENA', 1000)
    await pay(r.id, 'SENA', 500)
    await pay(r.id, 'DEVOLUCION', 300)
    const d = (await getReservation(r.id))!
    expect(d.depositBalance).toBe(1200)
    expect(d.payments).toHaveLength(3)
    const m = d.items.find((i) => i.variantId === mesa)!
    expect(m).toMatchObject({ unitPrice: 100, currentPrice: 150, allocated: 1 })
    expect(d.items.find((i) => i.variantId === silla)!.currentPrice).toBe(120)
    expect(d.userName).toBe('Ana')
  })

  it('llama al vencimiento antes de leer', async () => {
    await prisma.storeSettings.create({ data: { id: 1, reservationExpiryEnabled: true, reservationExpiryDays: 1 } })
    const r = await make(ana, 'LISTA', [{ variantId: mesa, quantity: 1, allocated: 1 }], { readyAt: new Date('2026-01-01') })
    expect((await getReservation(r.id))!.status).toBe('VENCIDA')
  })
})

describe('listReservations', () => {
  it('separa pestañas por estado', async () => {
    await make(ana, 'ESPERANDO', [{ variantId: silla, quantity: 1, allocated: 0 }])
    await make(ana, 'LISTA', [{ variantId: mesa, quantity: 1, allocated: 1 }])
    await make(ana, 'CANCELADA', [{ variantId: mesa, quantity: 1, allocated: 0 }])
    await make(ana, 'CONCRETADA', [{ variantId: mesa, quantity: 1, allocated: 0 }])
    expect((await listReservations({ tab: 'esperando' })).total).toBe(1)
    expect((await listReservations({ tab: 'listas' })).total).toBe(1)
    expect((await listReservations({ tab: 'cerradas' })).total).toBe(2)
  })

  it('una reserva con un ítem apartado y otro esperando muestra los faltantes', async () => {
    await make(ana, 'ESPERANDO', [{ variantId: mesa, quantity: 1, allocated: 1 }, { variantId: silla, quantity: 6, allocated: 2 }])
    const { rows } = await listReservations({ tab: 'esperando' })
    expect(rows[0].missingUnits).toBe(4)
    expect(rows[0].items).toHaveLength(2)
  })

  it('con userId sólo trae las de esa vendedora', async () => {
    await make(ana, 'LISTA', [{ variantId: mesa, quantity: 1, allocated: 1 }])
    await make(bea, 'LISTA', [{ variantId: mesa, quantity: 1, allocated: 1 }])
    expect((await listReservations({ tab: 'listas', userId: bea })).total).toBe(1)
    expect(await countReadyReservations(ana)).toBe(1)
    expect(await countReadyReservations()).toBe(2)
  })
})

describe('listUnresolvedDeposits', () => {
  it('sólo trae cerradas con seña neta sin resolver', async () => {
    const sinResolver = await make(ana, 'VENCIDA', [{ variantId: mesa, quantity: 1, allocated: 0 }])
    await pay(sinResolver.id, 'SENA', 500)
    const resuelta = await make(ana, 'CANCELADA', [{ variantId: mesa, quantity: 1, allocated: 0 }], { depositResolution: 'RETENIDA' })
    await pay(resuelta.id, 'SENA', 500)
    await make(ana, 'VENCIDA', [{ variantId: mesa, quantity: 1, allocated: 0 }])
    const devuelta = await make(ana, 'VENCIDA', [{ variantId: mesa, quantity: 1, allocated: 0 }])
    await pay(devuelta.id, 'SENA', 500)
    await pay(devuelta.id, 'DEVOLUCION', 500)
    const abierta = await make(ana, 'LISTA', [{ variantId: mesa, quantity: 1, allocated: 1 }])
    await pay(abierta.id, 'SENA', 500)
    const rows = await listUnresolvedDeposits()
    expect(rows.map((r) => r.id)).toEqual([sinResolver.id])
    expect(rows[0].depositBalance).toBe(500)
  })
})
