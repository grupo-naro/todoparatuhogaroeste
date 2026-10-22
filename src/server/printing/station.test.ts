import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { prisma, resetDb } from '@/test/db'
import { isValidStationKey, listPendingJobs, markJobPrinted } from './station'
import type { QuotePayload } from './queue'

const HOUR = 60 * 60 * 1000
const quote: QuotePayload = {
  lines: [{ productName: 'Mesa', variantName: 'A', unitPrice: 100, quantity: 1 }],
  total: 100, customerName: null, issuedAt: '2026-10-22T15:00:00.000Z',
}

let userId: string, v1: string

async function makeSale(cancelled = false) {
  const sale = await prisma.sale.create({
    data: {
      userId, paymentMethod: 'EFECTIVO', total: 100,
      cancelledAt: cancelled ? new Date() : null, cancelledById: cancelled ? userId : null,
      items: { create: [{ variantId: v1, quantity: 1, unitPrice: 100, subtotal: 100 }] },
    },
  })
  return sale.id
}

beforeEach(async () => {
  await resetDb()
  userId = (await prisma.user.create({ data: { email: 'a@a.com', name: 'Ana', passwordHash: 'x', role: 'VENDEDOR' } })).id
  const c = await prisma.category.create({ data: { name: 'Mesas', slug: 'mesas' } })
  const p = await prisma.product.create({
    data: { name: 'Mesa', categoryId: c.id, variants: { create: [{ name: 'A', price: 100 }] } },
    include: { variants: true },
  })
  v1 = p.variants[0].id
})
afterEach(() => vi.unstubAllEnvs())

describe('isValidStationKey', () => {
  it('es falso si PRINT_STATION_KEY no está definida o está vacía, aunque llegue vacía', () => {
    vi.stubEnv('PRINT_STATION_KEY', '')
    expect(isValidStationKey('')).toBe(false)
    expect(isValidStationKey(null)).toBe(false)
    expect(isValidStationKey('algo')).toBe(false)
  })
  it('es falso con una clave de otro largo (sin lanzar error) o incorrecta', () => {
    vi.stubEnv('PRINT_STATION_KEY', 'secreto-largo')
    expect(isValidStationKey('x')).toBe(false)
    expect(isValidStationKey('secreto-larga')).toBe(false)
  })
  it('es verdadero con la clave correcta', () => {
    vi.stubEnv('PRINT_STATION_KEY', 'secreto-largo')
    expect(isValidStationKey('secreto-largo')).toBe(true)
  })
})

describe('listPendingJobs', () => {
  it('excluye impresos y los de más de 12 horas, del más viejo al más nuevo', async () => {
    const now = new Date()
    const s1 = await makeSale()
    await prisma.printJob.create({ data: { kind: 'VENTA', saleId: s1, createdAt: new Date(now.getTime() - 2 * HOUR) } })
    await prisma.printJob.create({ data: { kind: 'PRESUPUESTO', payload: quote, createdAt: new Date(now.getTime() - 1 * HOUR) } })
    await prisma.printJob.create({ data: { kind: 'PRESUPUESTO', payload: quote, createdAt: new Date(now.getTime() - 3 * HOUR), printedAt: now } })
    await prisma.printJob.create({ data: { kind: 'PRESUPUESTO', payload: quote, createdAt: new Date(now.getTime() - 13 * HOUR) } })

    const jobs = await listPendingJobs(now)
    expect(jobs.map((j) => j.kind)).toEqual(['VENTA', 'PRESUPUESTO'])
    const venta = jobs[0]
    if (venta.kind !== 'VENTA') throw new Error('esperaba VENTA')
    expect(venta.sale).toMatchObject({ id: s1, total: 100, userName: 'Ana' })
    expect(venta.sale.items[0]).toMatchObject({ productName: 'Mesa', variantName: 'A', quantity: 1 })
    const presupuesto = jobs[1]
    if (presupuesto.kind !== 'PRESUPUESTO') throw new Error('esperaba PRESUPUESTO')
    expect(presupuesto.quote).toEqual(quote)
  })

  it('devuelve como máximo 10 trabajos', async () => {
    for (let i = 0; i < 12; i++) await prisma.printJob.create({ data: { kind: 'PRESUPUESTO', payload: quote } })
    expect(await listPendingJobs()).toHaveLength(10)
  })

  it('incluye una venta anulada antes de imprimirse, con su cancelledAt', async () => {
    const id = await makeSale(true)
    await prisma.printJob.create({ data: { kind: 'VENTA', saleId: id } })
    const [job] = await listPendingJobs()
    if (job.kind !== 'VENTA') throw new Error('esperaba VENTA')
    expect(job.sale.cancelledAt).not.toBeNull()
  })
})

describe('markJobPrinted', () => {
  it('es idempotente: marcar dos veces conserva el primer printedAt', async () => {
    const job = await prisma.printJob.create({ data: { kind: 'PRESUPUESTO', payload: quote } })
    await markJobPrinted(job.id)
    const first = (await prisma.printJob.findUniqueOrThrow({ where: { id: job.id } })).printedAt
    expect(first).not.toBeNull()
    await new Promise((r) => setTimeout(r, 20))
    await markJobPrinted(job.id)
    const second = (await prisma.printJob.findUniqueOrThrow({ where: { id: job.id } })).printedAt
    expect(second).toEqual(first)
  })
})
