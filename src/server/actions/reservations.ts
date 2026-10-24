'use server'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/server/db'
import { requireRole } from '@/server/auth/guards'
import { effectivePrice, toNumber } from '@/lib/pricing'
import { resolveCustomer } from '@/server/customers/resolve'
import { availableUnits, lockVariantStock, refreshReservationStatus } from '@/server/reservations/stock'
import { addDepositSchema, createReservationSchema } from '@/server/validation/reservations'

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
