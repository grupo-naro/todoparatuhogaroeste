import { beforeEach, describe, expect, it } from 'vitest'
import { prisma, resetDb } from '@/test/db'
import { expireOverdueReservations } from './expiry'

let userId: string
let silla: string
const DAY = 24 * 60 * 60 * 1000
const now = new Date('2026-10-24T12:00:00Z')

async function listaDesde(readyAt: Date, createdAt = new Date('2026-09-01')) {
  return prisma.reservation.create({
    data: {
      userId, status: 'LISTA', readyAt, createdAt,
      items: { create: [{ variantId: silla, quantity: 2, allocated: 2, unitPrice: 50 }] },
    },
  })
}
const setSettings = (enabled: boolean, days: number) =>
  prisma.storeSettings.upsert({ where: { id: 1 }, update: { reservationExpiryEnabled: enabled, reservationExpiryDays: days }, create: { id: 1, reservationExpiryEnabled: enabled, reservationExpiryDays: days } })

beforeEach(async () => {
  await resetDb()
  userId = (await prisma.user.create({ data: { email: 'a@a.com', passwordHash: 'x', name: 'Ana', role: 'VENDEDOR' } })).id
  const c = await prisma.category.create({ data: { name: 'Sillas', slug: 'sillas' } })
  const p = await prisma.product.create({ data: { name: 'Silla', categoryId: c.id, variants: { create: [{ name: 'Verde', price: 50 }] } }, include: { variants: true } })
  silla = p.variants[0].id
  await prisma.inventoryStock.create({ data: { variantId: silla, quantity: 2 } })
})

describe('expireOverdueReservations', () => {
  it('con el interruptor apagado no vence nada', async () => {
    await setSettings(false, 7)
    const r = await listaDesde(new Date(now.getTime() - 30 * DAY))
    expect(await expireOverdueReservations(now)).toBe(0)
    expect((await prisma.reservation.findUniqueOrThrow({ where: { id: r.id } })).status).toBe('LISTA')
  })

  it('vence una LISTA pasados N días desde readyAt, no desde createdAt', async () => {
    await setSettings(true, 7)
    const vieja = await listaDesde(new Date(now.getTime() - 8 * DAY))
    const reciente = await listaDesde(new Date(now.getTime() - 2 * DAY), new Date('2026-01-01'))
    expect(await expireOverdueReservations(now)).toBe(1)
    const v = await prisma.reservation.findUniqueOrThrow({ where: { id: vieja.id }, include: { items: true } })
    expect(v.status).toBe('VENCIDA')
    expect(v.closedAt).not.toBeNull()
    expect(v.items[0].allocated).toBe(0)
    expect((await prisma.reservation.findUniqueOrThrow({ where: { id: reciente.id } })).status).toBe('LISTA')
  })

  it('no vence una ESPERANDO por vieja que sea', async () => {
    await setSettings(true, 1)
    const r = await prisma.reservation.create({
      data: { userId, status: 'ESPERANDO', createdAt: new Date('2026-01-01'), items: { create: [{ variantId: silla, quantity: 5, allocated: 0, unitPrice: 50 }] } },
    })
    expect(await expireOverdueReservations(now)).toBe(0)
    expect((await prisma.reservation.findUniqueOrThrow({ where: { id: r.id } })).status).toBe('ESPERANDO')
  })

  it('lo liberado se aparta a otra reserva que esperaba', async () => {
    await setSettings(true, 7)
    await listaDesde(new Date(now.getTime() - 10 * DAY))
    const espera = await prisma.reservation.create({
      data: { userId, status: 'ESPERANDO', items: { create: [{ variantId: silla, quantity: 2, allocated: 0, unitPrice: 50 }] } },
      include: { items: true },
    })
    await expireOverdueReservations(now)
    const r = await prisma.reservation.findUniqueOrThrow({ where: { id: espera.id }, include: { items: true } })
    expect(r.items[0].allocated).toBe(2)
    expect(r.status).toBe('LISTA')
  })
})
