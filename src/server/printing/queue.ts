import 'server-only'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/server/db'

export type QuotePayload = {
  lines: { productName: string; variantName: string; unitPrice: number; quantity: number }[]
  total: number
  customerName: string | null
  shippingAddress?: string | null
  issuedAt: string
}

const RETENTION_MS = 7 * 24 * 60 * 60 * 1000

export async function enqueueSalePrint(tx: Prisma.TransactionClient, saleId: string): Promise<void> {
  await tx.printJob.create({ data: { kind: 'VENTA', saleId } })
}

export async function purgeOldPrintJobs(now: Date = new Date()): Promise<number> {
  const { count } = await prisma.printJob.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - RETENTION_MS) } } })
  return count
}

export async function enqueueQuotePrint(payload: QuotePayload): Promise<void> {
  await purgeOldPrintJobs()
  await prisma.printJob.create({ data: { kind: 'PRESUPUESTO', payload } })
}
