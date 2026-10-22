import { describe, expect, it, beforeEach } from 'vitest'
import { prisma, resetDb } from '@/test/db'
import { enqueueSalePrint, enqueueQuotePrint, purgeOldPrintJobs, type QuotePayload } from './queue'

let saleId: string

const quote: QuotePayload = {
  lines: [{ productName: 'Mesa', variantName: 'A', unitPrice: 100, quantity: 2 }],
  total: 200,
  customerName: 'Ana',
  issuedAt: '2026-10-22T15:00:00.000Z',
}

const DAY = 24 * 60 * 60 * 1000

beforeEach(async () => {
  await resetDb()
  const user = await prisma.user.create({ data: { email: 'a@a.com', name: 'Ana', passwordHash: 'x', role: 'VENDEDOR' } })
  const sale = await prisma.sale.create({ data: { userId: user.id, paymentMethod: 'EFECTIVO', total: 0 } })
  saleId = sale.id
})

describe('enqueueSalePrint', () => {
  it('crea un trabajo VENTA con el saleId y sin imprimir', async () => {
    await prisma.$transaction((tx) => enqueueSalePrint(tx, saleId))
    const jobs = await prisma.printJob.findMany()
    expect(jobs).toHaveLength(1)
    expect(jobs[0]).toMatchObject({ kind: 'VENTA', saleId, printedAt: null, payload: null })
  })
})

describe('enqueueQuotePrint', () => {
  it('crea un trabajo PRESUPUESTO con el payload tal cual', async () => {
    await enqueueQuotePrint(quote)
    const jobs = await prisma.printJob.findMany()
    expect(jobs).toHaveLength(1)
    expect(jobs[0]).toMatchObject({ kind: 'PRESUPUESTO', saleId: null, printedAt: null })
    expect(jobs[0].payload).toEqual(quote)
  })

  it('al encolar uno nuevo borra los trabajos de más de 7 días', async () => {
    await prisma.printJob.create({ data: { kind: 'PRESUPUESTO', payload: quote, createdAt: new Date(Date.now() - 8 * DAY) } })
    await enqueueQuotePrint(quote)
    expect(await prisma.printJob.count()).toBe(1)
  })
})

describe('purgeOldPrintJobs', () => {
  it('borra el de hace 8 días y deja el de hace 6', async () => {
    await prisma.printJob.create({ data: { kind: 'PRESUPUESTO', payload: quote, createdAt: new Date(Date.now() - 8 * DAY) } })
    const recent = await prisma.printJob.create({ data: { kind: 'PRESUPUESTO', payload: quote, createdAt: new Date(Date.now() - 6 * DAY) } })
    const deleted = await purgeOldPrintJobs()
    expect(deleted).toBe(1)
    const left = await prisma.printJob.findMany()
    expect(left.map((j) => j.id)).toEqual([recent.id])
  })
})
