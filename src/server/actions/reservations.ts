'use server'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/server/db'
import { requireRole } from '@/server/auth/guards'
import { effectivePrice, toNumber } from '@/lib/pricing'
import { resolveCustomer } from '@/server/customers/resolve'
import type { Prisma } from '@prisma/client'
import { enqueueSalePrint } from '@/server/printing/queue'
import { allocateWaiting, availableUnits, lockVariantStock, refreshReservationStatus } from '@/server/reservations/stock'
import {
  addDepositSchema, cancelReservationSchema, convertReservationSchema, createReservationSchema, resolveDepositSchema,
} from '@/server/validation/reservations'

type Tx = Prisma.TransactionClient

export type ActionResult = { ok: true } | { ok: false; error: string }
export type CreateReservationResult =
  | { ok: true; reservationId: string; number: number }
  | { ok: false; error: string }

function revalidateReservations() {
  revalidatePath('/reservas')
  revalidatePath('/deposito')
  revalidatePath('/')
}

export async function createReservation(input: unknown): Promise<CreateReservationResult> {
  const session = await requireRole(['ADMIN', 'VENDEDOR'])
  const parsed = createReservationSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  const data = parsed.data

  // Fusiona líneas repetidas y las ordena: los bloqueos de stock se toman siempre en el mismo orden.
  const merged = new Map<string, number>()
  for (const item of data.items) merged.set(item.variantId, (merged.get(item.variantId) ?? 0) + item.quantity)
  const items = [...merged.entries()].map(([variantId, quantity]) => ({ variantId, quantity }))
    .sort((a, b) => a.variantId.localeCompare(b.variantId))

  const result = await prisma.$transaction(async (tx): Promise<CreateReservationResult> => {
    const lines: { variantId: string; quantity: number; allocated: number; unitPrice: number }[] = []
    for (const item of items) {
      const variant = await tx.productVariant.findUnique({
        where: { id: item.variantId },
        include: { product: { select: { name: true, defaultPrice: true } } },
      })
      if (!variant) return { ok: false, error: 'Producto no encontrado' }
      const unitPrice = effectivePrice({ price: toNumber(variant.price) }, { defaultPrice: toNumber(variant.product.defaultPrice) })
      if (unitPrice === null) return { ok: false, error: `${variant.product.name} · ${variant.name} no tiene precio cargado` }

      await lockVariantStock(tx, item.variantId)
      const available = await availableUnits(tx, item.variantId)
      lines.push({ variantId: item.variantId, quantity: item.quantity, allocated: Math.min(item.quantity, available), unitPrice })
    }

    const customer = await resolveCustomer(tx, { phone: data.customerPhone, name: data.customerName })
    if (!customer.ok) return { ok: false, error: customer.error }

    const reservation = await tx.reservation.create({
      data: {
        userId: session.sub,
        customerId: customer.customerId,
        customerName: data.customerName || customer.name || null,
        customerPhone: customer.phone ?? null,
        shippingAddress: data.shippingAddress || null,
        note: data.note || null,
        items: { create: lines },
        ...(data.deposit
          ? { payments: { create: { kind: 'SENA', amount: data.deposit.amount, paymentMethod: data.deposit.paymentMethod, userId: session.sub } } }
          : {}),
      },
    })
    await refreshReservationStatus(tx, reservation.id)
    return { ok: true, reservationId: reservation.id, number: reservation.number }
  })

  if (result.ok) revalidateReservations()
  return result
}

async function findOwn(id: string, session: { sub: string; role: string }) {
  const reservation = await prisma.reservation.findUnique({ where: { id } })
  if (!reservation || (session.role === 'VENDEDOR' && reservation.userId !== session.sub)) return null
  return reservation
}

export async function addDeposit(input: unknown): Promise<ActionResult> {
  const session = await requireRole(['ADMIN', 'VENDEDOR'])
  const parsed = addDepositSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  const reservation = await findOwn(parsed.data.reservationId, session)
  if (!reservation) return { ok: false, error: 'Reserva no encontrada' }
  if (reservation.status !== 'ESPERANDO' && reservation.status !== 'LISTA') {
    return { ok: false, error: 'Esta reserva ya está cerrada' }
  }
  await prisma.reservationPayment.create({
    data: {
      reservationId: reservation.id, kind: 'SENA', amount: parsed.data.amount,
      paymentMethod: parsed.data.paymentMethod, userId: session.sub,
    },
  })
  revalidateReservations()
  revalidatePath(`/reservas/${reservation.id}`)
  return { ok: true }
}

export async function markReservationNotified(id: string): Promise<ActionResult> {
  const session = await requireRole(['ADMIN', 'VENDEDOR'])
  const reservation = await findOwn(id, session)
  if (!reservation) return { ok: false, error: 'Reserva no encontrada' }
  await prisma.reservation.update({ where: { id }, data: { notifiedAt: new Date() } })
  revalidatePath(`/reservas/${id}`)
  revalidatePath('/reservas')
  return { ok: true }
}

type Decision = { action: 'DEVOLVER'; paymentMethod: 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA' } | { action: 'RETENER' }

const net = (payments: { kind: string; amount: unknown }[]) =>
  payments.reduce((s, p) => s + (p.kind === 'SENA' ? 1 : -1) * (toNumber(p.amount as never) ?? 0), 0)

// Aplica la decisión de la vendedora sobre la seña neta: devolver (sale de caja) o retener.
async function settleDeposit(tx: Tx, reservationId: string, userId: string, balance: number, decision: Decision) {
  if (decision.action === 'DEVOLVER') {
    await tx.reservationPayment.create({
      data: { reservationId, kind: 'DEVOLUCION', amount: balance, paymentMethod: decision.paymentMethod, userId },
    })
  }
  await tx.reservation.update({
    where: { id: reservationId },
    data: { depositResolution: decision.action === 'DEVOLVER' ? 'DEVUELTA' : 'RETENIDA' },
  })
}

export async function cancelReservation(input: unknown): Promise<ActionResult> {
  const session = await requireRole(['ADMIN', 'VENDEDOR'])
  const parsed = cancelReservationSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  const own = await findOwn(parsed.data.id, session)
  if (!own) return { ok: false, error: 'Reserva no encontrada' }

  const result = await prisma.$transaction(async (tx): Promise<ActionResult> => {
    const r = await tx.reservation.findUniqueOrThrow({ where: { id: own.id }, include: { items: true, payments: true } })
    if (r.status !== 'ESPERANDO' && r.status !== 'LISTA') return { ok: false, error: 'Esta reserva ya está cerrada' }
    const balance = net(r.payments)
    if (balance > 0 && !parsed.data.deposit) return { ok: false, error: 'Elegí si devolvés o retenés la seña' }

    const variantIds = [...new Set(r.items.map((i) => i.variantId))].sort()
    for (const id of variantIds) await lockVariantStock(tx, id)
    await tx.reservation.update({ where: { id: r.id }, data: { status: 'CANCELADA', closedAt: new Date() } })
    await tx.reservationItem.updateMany({ where: { reservationId: r.id }, data: { allocated: 0 } })
    if (balance > 0 && parsed.data.deposit) await settleDeposit(tx, r.id, session.sub, balance, parsed.data.deposit)
    for (const id of variantIds) await allocateWaiting(tx, id)
    return { ok: true }
  })
  if (result.ok) {
    revalidateReservations()
    revalidatePath(`/reservas/${own.id}`)
  }
  return result
}

export async function resolveDeposit(input: unknown): Promise<ActionResult> {
  const session = await requireRole(['ADMIN', 'VENDEDOR'])
  const parsed = resolveDepositSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  const own = await findOwn(parsed.data.id, session)
  if (!own) return { ok: false, error: 'Reserva no encontrada' }

  const result = await prisma.$transaction(async (tx): Promise<ActionResult> => {
    const r = await tx.reservation.findUniqueOrThrow({ where: { id: own.id }, include: { payments: true } })
    if ((r.status !== 'CANCELADA' && r.status !== 'VENCIDA') || r.depositResolution) {
      return { ok: false, error: 'Esta reserva no tiene una seña pendiente de resolver' }
    }
    const balance = net(r.payments)
    if (balance <= 0) return { ok: false, error: 'Esta reserva no tiene una seña pendiente de resolver' }
    await settleDeposit(tx, r.id, session.sub, balance, parsed.data.deposit)
    return { ok: true }
  })
  if (result.ok) {
    revalidateReservations()
    revalidatePath(`/reservas/${own.id}`)
  }
  return result
}

export type PriceChange = { productName: string; variantName: string; reserved: number; current: number | null }
export type ConvertReservationResult =
  | { ok: true; saleId: string; number: number }
  | { ok: false; error: string; priceChanges?: PriceChange[] }

export async function convertReservation(input: unknown): Promise<ConvertReservationResult> {
  const session = await requireRole(['ADMIN', 'VENDEDOR'])
  const parsed = convertReservationSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  const own = await findOwn(parsed.data.id, session)
  if (!own) return { ok: false, error: 'Reserva no encontrada' }

  const result = await prisma.$transaction(async (tx): Promise<ConvertReservationResult> => {
    const r = await tx.reservation.findUniqueOrThrow({
      where: { id: own.id },
      include: {
        payments: true,
        items: { include: { variant: { select: { name: true, price: true, product: { select: { name: true, defaultPrice: true } } } } } },
      },
    })
    if (r.status === 'ESPERANDO') return { ok: false, error: 'La reserva todavía tiene productos esperando stock' }
    if (r.status !== 'LISTA') return { ok: false, error: 'Esta reserva ya no está lista para concretar' }

    const lines = r.items.map((i) => ({
      variantId: i.variantId, quantity: i.quantity,
      productName: i.variant.product.name, variantName: i.variant.name,
      reserved: toNumber(i.unitPrice) ?? 0,
      current: effectivePrice({ price: toNumber(i.variant.price) }, { defaultPrice: toNumber(i.variant.product.defaultPrice) }),
    }))
    const changes = lines.filter((l) => l.current !== l.reserved)
    if (changes.length > 0 && !parsed.data.priceMode) {
      return {
        ok: false, error: 'Cambiaron los precios desde la reserva: elegí cuál cobrar',
        priceChanges: changes.map((l) => ({ productName: l.productName, variantName: l.variantName, reserved: l.reserved, current: l.current })),
      }
    }
    const useCurrent = parsed.data.priceMode === 'ACTUAL'
    const priced = lines.map((l) => ({ ...l, unitPrice: useCurrent ? l.current : l.reserved }))
    const missing = priced.find((l) => l.unitPrice === null)
    if (missing) return { ok: false, error: `${missing.productName} · ${missing.variantName} no tiene precio cargado` }

    const sale = priced.map((l) => ({ ...l, unitPrice: l.unitPrice as number, subtotal: (l.unitPrice as number) * l.quantity }))
    const total = sale.reduce((s, l) => s + l.subtotal, 0)
    const deposit = net(r.payments)
    if (deposit > total) {
      return { ok: false, error: 'La seña supera el total. Registrá la devolución de la diferencia antes de concretar' }
    }

    // Reclamar la reserva: si dos concreciones corren a la vez, sólo una cambia el estado.
    const claimed = await tx.reservation.updateMany({ where: { id: r.id, status: 'LISTA' }, data: { status: 'CONCRETADA', closedAt: new Date() } })
    if (claimed.count === 0) return { ok: false, error: 'Esta reserva ya no está lista para concretar' }

    const created = await tx.sale.create({
      data: {
        userId: session.sub, paymentMethod: parsed.data.paymentMethod, customerId: r.customerId,
        shippingAddress: r.shippingAddress, total, depositApplied: deposit,
        items: { create: sale.map((l) => ({ variantId: l.variantId, quantity: l.quantity, unitPrice: l.unitPrice, subtotal: l.subtotal })) },
      },
    })
    for (const line of [...sale].sort((a, b) => a.variantId.localeCompare(b.variantId))) {
      await lockVariantStock(tx, line.variantId)
      const current = await tx.inventoryStock.findUniqueOrThrow({ where: { variantId: line.variantId } })
      const after = current.quantity - line.quantity
      await tx.inventoryStock.update({ where: { variantId: line.variantId }, data: { quantity: after } })
      await tx.inventoryTransaction.create({
        data: { variantId: line.variantId, type: 'VENTA', quantityDelta: -line.quantity, quantityAfter: after, userId: session.sub, batchId: created.id },
      })
    }
    await tx.reservationItem.updateMany({ where: { reservationId: r.id }, data: { allocated: 0 } })
    await tx.reservation.update({ where: { id: r.id }, data: { saleId: created.id } })
    await enqueueSalePrint(tx, created.id)
    return { ok: true, saleId: created.id, number: created.number }
  })
  if (result.ok) {
    revalidateReservations()
    revalidatePath('/ventas')
    revalidatePath(`/reservas/${own.id}`)
  }
  return result
}
