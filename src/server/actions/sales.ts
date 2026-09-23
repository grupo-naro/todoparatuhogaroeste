'use server'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/server/db'
import { requireRole } from '@/server/auth/guards'
import { effectivePrice, toNumber } from '@/lib/pricing'
import { createSaleSchema } from '@/server/validation/sales'
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
  const items = [...merged.entries()].map(([variantId, quantity]) => ({ variantId, quantity }))

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

      const available = variant.stock?.quantity ?? 0
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

    const sale = await tx.sale.create({
      data: {
        userId: session.sub,
        paymentMethod: parsed.data.paymentMethod,
        total,
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

    return { ok: true, sale }
  })

  if (!result.ok) return { ok: false, error: result.error }
  revalidatePath('/deposito')
  revalidatePath('/ventas')
  return { ok: true, saleId: result.sale.id, number: result.sale.number }
}

export async function searchSellableVariantsAction(q: string): Promise<SellableVariant[]> {
  await requireRole(['ADMIN', 'VENDEDOR'])
  return searchSellableVariants(q)
}
