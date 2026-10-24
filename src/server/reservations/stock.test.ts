import { beforeEach, describe, expect, it } from 'vitest'
import { prisma, resetDb } from '@/test/db'
import { allocateWaiting, availableUnits, reservedUnits, reservedUnitsByVariant } from './stock'

let userId: string
let mesa: string
let silla: string

async function reservation(items: { variantId: string; quantity: number; allocated?: number }[], over: { status?: 'ESPERANDO' | 'LISTA' | 'CANCELADA' | 'VENCIDA' | 'CONCRETADA'; createdAt?: Date } = {}) {
  return prisma.reservation.create({
    data: {
      userId, status: over.status ?? 'ESPERANDO', createdAt: over.createdAt,
      items: { create: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity, allocated: i.allocated ?? 0, unitPrice: 100 })) },
    },
    include: { items: true },
  })
}

const setStock = (variantId: string, quantity: number) =>
  prisma.inventoryStock.upsert({ where: { variantId }, update: { quantity }, create: { variantId, quantity } })

beforeEach(async () => {
  await resetDb()
  userId = (await prisma.user.create({ data: { email: 'a@a.com', passwordHash: 'x', name: 'Ana', role: 'VENDEDOR' } })).id
  const c = await prisma.category.create({ data: { name: 'Mesas', slug: 'mesas' } })
  const p = await prisma.product.create({
    data: { name: 'Juego', categoryId: c.id, variants: { create: [{ name: 'Mesa', price: 100 }, { name: 'Silla verde', price: 50 }] } },
    include: { variants: true },
  })
  mesa = p.variants.find((v) => v.name === 'Mesa')!.id
  silla = p.variants.find((v) => v.name === 'Silla verde')!.id
})

const run = <T,>(fn: (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => Promise<T>) => prisma.$transaction(fn)

describe('allocateWaiting', () => {
  it('reparte lo repuesto por antigüedad y cubre sólo lo que alcanza', async () => {
    const vieja = await reservation([{ variantId: silla, quantity: 2 }], { createdAt: new Date('2026-10-01') })
    const nueva = await reservation([{ variantId: silla, quantity: 2 }], { createdAt: new Date('2026-10-02') })
    await setStock(silla, 3)
    await run((tx) => allocateWaiting(tx, silla))
    const a = await prisma.reservation.findUniqueOrThrow({ where: { id: vieja.id }, include: { items: true } })
    const b = await prisma.reservation.findUniqueOrThrow({ where: { id: nueva.id }, include: { items: true } })
    expect(a.items[0].allocated).toBe(2)
    expect(a.status).toBe('LISTA')
    expect(a.readyAt).not.toBeNull()
    expect(b.items[0].allocated).toBe(1)
    expect(b.status).toBe('ESPERANDO')
    expect(b.readyAt).toBeNull()
  })

  it('allocated nunca supera quantity aunque sobre stock', async () => {
    const r = await reservation([{ variantId: silla, quantity: 2 }])
    await setStock(silla, 10)
    await run((tx) => allocateWaiting(tx, silla))
    const item = await prisma.reservationItem.findFirstOrThrow({ where: { reservationId: r.id } })
    expect(item.allocated).toBe(2)
  })

  it('una reserva con varios productos pasa a LISTA sólo cuando todos están cubiertos', async () => {
    const r = await reservation([{ variantId: mesa, quantity: 1, allocated: 1 }, { variantId: silla, quantity: 6 }])
    await setStock(mesa, 1)
    await setStock(silla, 4)
    await run((tx) => allocateWaiting(tx, silla))
    expect((await prisma.reservation.findUniqueOrThrow({ where: { id: r.id } })).status).toBe('ESPERANDO')
    await setStock(silla, 6)
    await run((tx) => allocateWaiting(tx, silla))
    expect((await prisma.reservation.findUniqueOrThrow({ where: { id: r.id } })).status).toBe('LISTA')
  })

  it('no considera lo ya apartado por otras reservas como disponible', async () => {
    await reservation([{ variantId: silla, quantity: 2, allocated: 2 }], { status: 'LISTA' })
    const espera = await reservation([{ variantId: silla, quantity: 2 }])
    await setStock(silla, 3)
    await run((tx) => allocateWaiting(tx, silla))
    const item = await prisma.reservationItem.findFirstOrThrow({ where: { reservationId: espera.id } })
    expect(item.allocated).toBe(1)
  })
})

describe('availableUnits / reservedUnits', () => {
  it('descuenta lo apartado y no baja de 0', async () => {
    await setStock(mesa, 3)
    await reservation([{ variantId: mesa, quantity: 2, allocated: 2 }], { status: 'LISTA' })
    expect(await run((tx) => reservedUnits(tx, mesa))).toBe(2)
    expect(await run((tx) => availableUnits(tx, mesa))).toBe(1)
    await setStock(mesa, 1)
    expect(await run((tx) => availableUnits(tx, mesa))).toBe(0)
  })

  it('una variante sin fila de stock tiene 0 disponible', async () => {
    expect(await run((tx) => availableUnits(tx, mesa))).toBe(0)
  })

  it('no considera reservas CANCELADA, VENCIDA ni CONCRETADA', async () => {
    await setStock(mesa, 5)
    for (const status of ['CANCELADA', 'VENCIDA', 'CONCRETADA'] as const) {
      await reservation([{ variantId: mesa, quantity: 1, allocated: 1 }], { status })
    }
    expect(await run((tx) => reservedUnits(tx, mesa))).toBe(0)
    expect(await run((tx) => availableUnits(tx, mesa))).toBe(5)
  })
})

describe('reservedUnitsByVariant', () => {
  it('devuelve el total apartado por variante, 0 si no hay', async () => {
    await reservation([{ variantId: mesa, quantity: 2, allocated: 1 }])
    await reservation([{ variantId: mesa, quantity: 1, allocated: 1 }])
    const map = await reservedUnitsByVariant([mesa, silla])
    expect(map.get(mesa)).toBe(2)
    expect(map.get(silla) ?? 0).toBe(0)
  })
})
