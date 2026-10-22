import 'server-only'
import { timingSafeEqual } from 'node:crypto'
import { prisma } from '@/server/db'
import { getSale, type SaleDetail } from '@/server/queries/sales'
import { purgeOldPrintJobs, type QuotePayload } from './queue'

export type PrintableJob =
  | { id: string; kind: 'VENTA'; sale: SaleDetail }
  | { id: string; kind: 'PRESUPUESTO'; quote: QuotePayload }

const MAX_AGE_MS = 12 * 60 * 60 * 1000
const MAX_JOBS = 10

export function isValidStationKey(provided: string | null): boolean {
  const expected = process.env.PRINT_STATION_KEY
  if (!expected || !provided) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function listPendingJobs(now: Date = new Date()): Promise<PrintableJob[]> {
  const rows = await prisma.printJob.findMany({
    where: { printedAt: null, createdAt: { gte: new Date(now.getTime() - MAX_AGE_MS) } },
    orderBy: { createdAt: 'asc' },
    take: MAX_JOBS,
  })
  const jobs: PrintableJob[] = []
  for (const row of rows) {
    if (row.kind === 'VENTA' && row.saleId) {
      const sale = await getSale(row.saleId)
      if (sale) jobs.push({ id: row.id, kind: 'VENTA', sale })
    } else if (row.kind === 'PRESUPUESTO' && row.payload) {
      jobs.push({ id: row.id, kind: 'PRESUPUESTO', quote: row.payload as unknown as QuotePayload })
    }
  }
  return jobs
}

export async function markJobPrinted(id: string): Promise<void> {
  await prisma.printJob.updateMany({ where: { id, printedAt: null }, data: { printedAt: new Date() } })
  await purgeOldPrintJobs()
}
