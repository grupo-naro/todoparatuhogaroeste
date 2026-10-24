'use server'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/server/db'
import { requireRole } from '@/server/auth/guards'
import { effectivePrice, toNumber } from '@/lib/pricing'
import { resolveCustomer } from '@/server/customers/resolve'
import { createSaleSchema } from '@/server/validation/sales'
import { enqueueSalePrint } from '@/server/printing/queue'
import { allocateWaiting, availableUnits, lockVariantStock } from '@/server/reservations/stock'
import { expireOverdueReservations } from '@/server/reservations/expiry'
import { searchSellableVariants, type SellableVariant } from '@/server/queries/sales'

export type CreateSaleResult =
  | { ok: true; saleId: string; number: number }
  | { ok: false; error: string }

export async function createSale(input: unknown): Promise<CreateSaleResult> {
  const session = await requireRole(['ADMIN', 'VENDEDOR'])
  const parsed = createSaleSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  // Fusiona líneas repetidas de la misma variante antes de validar stock —
  // evita que dos líneas de la misma variante se validen cada una contra el
  // mismo stock original y terminen sobrevendiendo.
  const merged = new Map<string, number>()
  for (const item of parsed.data.items) {
    merged.set(item.variantId, (merged.get(item.variantId) ?? 0) + item.quantity)
  }
  // Orden fijo por variante: dos ventas simultáneas toman los bloqueos en el mismo orden.
  const items = [...merged.entries()].map(([variantId, quantity]) => ({ variantId, quantity }))
    .sort((a, b) => a.variantId.localeCompare(b.variantId))
  await expireOverdueReservations()

  // Discriminated union with an explicit `ok` tag, typed explicitly on the
  // transaction callback: without this, TS infers the callback's return type
  // from four differently-shaped `return` statements (three `{ error }`
  // objects plus one `{ sale }`) as a union with optional properties, which
  // defeats `in`-based narrowing below (`result.error` comes out as
  // `string | undefined` even after `'error' in result`).
  type TxResult = { ok: true; sale: { id: string; number: number } } | { ok: false; error: string }

  const result = await prisma.$transaction(async (tx): Promise<TxResult> => {
    const lines: { variantId: string; quantity: number; unitPrice: number; subtotal: number }[] = []
    let total = 0

    for (const item of items) {
      const variant = await tx.productVariant.findUnique({
        where: { id: item.variantId },
        include: { stock: true, product: { select: { name: true, defaultPrice: true } } },
      })
      if (!variant) return { ok: false, error: 'Producto no encontrado' }

      await lockVariantStock(tx, item.variantId)
      const available = await availableUnits(tx, item.variantId)
      if (item.quantity > available) {
        return { ok: false, error: `No hay stock suficiente de ${variant.product.name} · ${variant.name} (quedan ${available})` }
      }

      const unitPrice = effectivePrice({ price: toNumber(variant.price) }, { defaultPrice: toNumber(variant.product.defaultPrice) })
      if (unitPrice === null) {
        return { ok: false, error: `${variant.product.name} · ${variant.name} no tiene precio cargado` }
      }

      const subtotal = unitPrice * item.quantity
      total += subtotal
      lines.push({ variantId: item.variantId, quantity: item.quantity, unitPrice, subtotal })
    }

    const customer = await resolveCustomer(tx, { phone: parsed.data.customerPhone, name: parsed.data.customerName })
    if (!customer.ok) return { ok: false, error: customer.error }
    const customerId = customer.customerId

    const discount = parsed.data.discount ?? 0
    if (discount > total) return { ok: false, error: 'El descuento no puede superar el total' }

    const sale = await tx.sale.create({
      data: {
        userId: session.sub,
        paymentMethod: parsed.data.paymentMethod,
        customerId,
        shippingAddress: parsed.data.shippingAddress || null,
        total: total - discount,
        discount,
        discountReason: discount > 0 ? parsed.data.discountReason || null : null,
        items: { create: lines },
      },
    })

    for (const line of lines) {
      const current = await tx.inventoryStock.findUnique({ where: { variantId: line.variantId } })
      const before = current?.quantity ?? 0
      const after = before - line.quantity
      await tx.inventoryStock.update({ where: { variantId: line.variantId }, data: { quantity: after } })
      await tx.inventoryTransaction.create({
        data: {
          variantId: line.variantId, type: 'VENTA', quantityDelta: -line.quantity, quantityAfter: after,
          userId: session.sub, batchId: sale.id,
        },
      })
    }

    await enqueueSalePrint(tx, sale.id)

    return { ok: true, sale }
  })

  if (!result.ok) return { ok: false, error: result.error }
  revalidatePath('/deposito')
  revalidatePath('/ventas')
  revalidatePath('/clientes')
  return { ok: true, saleId: result.sale.id, number: result.sale.number }
}

export async function searchSellableVariantsAction(q: string): Promise<SellableVariant[]> {
  await requireRole(['ADMIN', 'VENDEDOR'])
  await expireOverdueReservations()
  return searchSellableVariants(q)
}

export type ActionResult = { ok: true } | { ok: false; error: string }

export async function cancelSale(id: string): Promise<ActionResult> {
  const session = await requireRole(['ADMIN', 'VENDEDOR'])
  const sale = await prisma.sale.findUnique({ where: { id }, include: { items: true } })
  if (!sale || (session.role === 'VENDEDOR' && sale.userId !== session.sub)) return { ok: false, error: 'Venta no encontrada' }
  if (sale.cancelledAt) return { ok: false, error: 'Esta venta ya fue anulada' }

  class AlreadyCancelled extends Error {}
  try {
    await prisma.$transaction(async (tx) => {
    // Reclamar la anulación: si dos llegan a la vez, sólo una repone el stock.
    const claimed = await tx.sale.updateMany({ where: { id, cancelledAt: null }, data: { cancelledAt: new Date(), cancelledById: session.sub } })
    if (claimed.count === 0) throw new AlreadyCancelled()
    const ordered = [...sale.items].sort((a, b) => a.variantId.localeCompare(b.variantId))
    for (const item of ordered) {
      await lockVariantStock(tx, item.variantId)
      const current = await tx.inventoryStock.findUnique({ where: { variantId: item.variantId } })
      const before = current?.quantity ?? 0
      const after = before + item.quantity
      await tx.inventoryStock.upsert({
        where: { variantId: item.variantId },
        update: { quantity: after },
        create: { variantId: item.variantId, quantity: after },
      })
      await tx.inventoryTransaction.create({
        data: {
          variantId: item.variantId, type: 'ANULACION', quantityDelta: item.quantity, quantityAfter: after,
          userId: session.sub, batchId: sale.id,
        },
      })
      await allocateWaiting(tx, item.variantId)
    }
    })
  } catch (e) {
    if (e instanceof AlreadyCancelled) return { ok: false, error: 'Esta venta ya fue anulada' }
    throw e
  }

  revalidatePath('/deposito')
  revalidatePath('/ventas')
  revalidatePath(`/ventas/${id}`)
  revalidatePath('/clientes')
  return { ok: true }
}
