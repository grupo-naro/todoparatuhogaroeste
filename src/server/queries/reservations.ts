import 'server-only'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/server/db'
import { effectivePrice, toNumber } from '@/lib/pricing'
import type { PaymentMethodName } from '@/lib/constants'
import { expireOverdueReservations } from '@/server/reservations/expiry'

export type ReservationStatusName = 'ESPERANDO' | 'LISTA' | 'CONCRETADA' | 'CANCELADA' | 'VENCIDA'
export type ReservationTab = 'esperando' | 'listas' | 'cerradas'
export const RESERVATIONS_PAGE_SIZE = 25

export type ReservationDetail = {
  id: string; number: number; status: ReservationStatusName; userName: string
  customerName: string | null; customerPhone: string | null; shippingAddress: string | null; shippingCity: string | null; note: string | null
  createdAt: Date; readyAt: Date | null; closedAt: Date | null; notifiedAt: Date | null
  saleId: string | null; depositResolution: 'DEVUELTA' | 'RETENIDA' | null
  items: { variantId: string; productName: string; variantName: string; quantity: number; allocated: number; unitPrice: number; currentPrice: number | null }[]
  payments: { id: string; kind: 'SENA' | 'DEVOLUCION'; amount: number; paymentMethod: PaymentMethodName; createdAt: Date; userName: string }[]
  depositBalance: number
  discount: number
  discountReason: string | null
}

export type ReservationRow = {
  id: string; number: number; status: ReservationStatusName; userName: string; customerName: string | null
  createdAt: Date; readyAt: Date | null; notifiedAt: Date | null
  items: { productName: string; variantName: string; quantity: number; allocated: number }[]
  missingUnits: number; depositBalance: number
}

const netDeposit = (payments: { kind: string; amount: Prisma.Decimal }[]) =>
  payments.reduce((s, p) => s + (p.kind === 'SENA' ? 1 : -1) * (toNumber(p.amount) ?? 0), 0)

const rowInclude = {
  user: { select: { name: true } },
  items: { include: { variant: { select: { name: true, product: { select: { name: true } } } } } },
  payments: { select: { kind: true, amount: true } },
} satisfies Prisma.ReservationInclude

type RowSource = Prisma.ReservationGetPayload<{ include: typeof rowInclude }>

function toRow(r: RowSource): ReservationRow {
  const items = r.items.map((i) => ({
    productName: i.variant.product.name, variantName: i.variant.name, quantity: i.quantity, allocated: i.allocated,
  }))
  return {
    id: r.id, number: r.number, status: r.status, userName: r.user.name, customerName: r.customerName,
    createdAt: r.createdAt, readyAt: r.readyAt, notifiedAt: r.notifiedAt, items,
    missingUnits: items.reduce((s, i) => s + (i.quantity - i.allocated), 0),
    depositBalance: netDeposit(r.payments),
  }
}

export async function getReservation(id: string, opts: { userId?: string } = {}): Promise<ReservationDetail | null> {
  await expireOverdueReservations()
  const r = await prisma.reservation.findFirst({
    where: { id, ...(opts.userId ? { userId: opts.userId } : {}) },
    include: {
      user: { select: { name: true } },
      items: { include: { variant: { select: { name: true, price: true, product: { select: { name: true, defaultPrice: true } } } } } },
      payments: { include: { user: { select: { name: true } } }, orderBy: { createdAt: 'asc' } },
    },
  })
  if (!r) return null
  return {
    id: r.id, number: r.number, status: r.status, userName: r.user.name,
    customerName: r.customerName, customerPhone: r.customerPhone, shippingAddress: r.shippingAddress, shippingCity: r.shippingCity, note: r.note,
    createdAt: r.createdAt, readyAt: r.readyAt, closedAt: r.closedAt, notifiedAt: r.notifiedAt,
    saleId: r.saleId, depositResolution: r.depositResolution,
    items: r.items.map((i) => ({
      variantId: i.variantId, productName: i.variant.product.name, variantName: i.variant.name,
      quantity: i.quantity, allocated: i.allocated, unitPrice: toNumber(i.unitPrice) ?? 0,
      currentPrice: effectivePrice({ price: toNumber(i.variant.price) }, { defaultPrice: toNumber(i.variant.product.defaultPrice) }),
    })),
    payments: r.payments.map((p) => ({
      id: p.id, kind: p.kind, amount: toNumber(p.amount) ?? 0, paymentMethod: p.paymentMethod,
      createdAt: p.createdAt, userName: p.user.name,
    })),
    depositBalance: netDeposit(r.payments),
    discount: toNumber(r.discount) ?? 0,
    discountReason: r.discountReason,
  }
}

export async function listReservations(
  params: { tab: ReservationTab; userId?: string; page?: number },
): Promise<{ rows: ReservationRow[]; total: number }> {
  await expireOverdueReservations()
  const page = Math.max(1, params.page ?? 1)
  const statuses: ReservationStatusName[] =
    params.tab === 'esperando' ? ['ESPERANDO'] : params.tab === 'listas' ? ['LISTA'] : ['CONCRETADA', 'CANCELADA', 'VENCIDA']
  const where: Prisma.ReservationWhereInput = { status: { in: statuses }, ...(params.userId ? { userId: params.userId } : {}) }
  const orderBy: Prisma.ReservationOrderByWithRelationInput =
    params.tab === 'cerradas' ? { closedAt: 'desc' } : params.tab === 'listas' ? { readyAt: 'asc' } : { createdAt: 'asc' }
  const [total, found] = await Promise.all([
    prisma.reservation.count({ where }),
    prisma.reservation.findMany({
      where, orderBy, include: rowInclude, skip: (page - 1) * RESERVATIONS_PAGE_SIZE, take: RESERVATIONS_PAGE_SIZE,
    }),
  ])
  return { rows: found.map(toRow), total }
}

export async function countReadyReservations(userId?: string): Promise<number> {
  return prisma.reservation.count({ where: { status: 'LISTA', ...(userId ? { userId } : {}) } })
}

export async function listUnresolvedDeposits(): Promise<ReservationRow[]> {
  await expireOverdueReservations()
  const found = await prisma.reservation.findMany({
    where: { status: { in: ['CANCELADA', 'VENCIDA'] }, depositResolution: null, payments: { some: {} } },
    include: rowInclude, orderBy: { closedAt: 'asc' },
  })
  return found.map(toRow).filter((r) => r.depositBalance > 0)
}
