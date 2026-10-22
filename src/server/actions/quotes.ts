'use server'
import { z } from 'zod'
import { prisma } from '@/server/db'
import { requireRole } from '@/server/auth/guards'
import { effectivePrice, toNumber } from '@/lib/pricing'
import { saleItemInputSchema } from '@/server/validation/sales'
import { enqueueQuotePrint, type QuotePayload } from '@/server/printing/queue'

const quoteSchema = z.object({
  items: z.array(saleItemInputSchema).min(1, 'Agregá al menos un producto'),
  customerName: z.string().trim().optional(),
})

export type EnqueueQuoteResult = { ok: true } | { ok: false; error: string }

export async function enqueueQuote(input: unknown): Promise<EnqueueQuoteResult> {
  await requireRole(['ADMIN', 'VENDEDOR'])
  const parsed = quoteSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const merged = new Map<string, number>()
  for (const item of parsed.data.items) {
    merged.set(item.variantId, (merged.get(item.variantId) ?? 0) + item.quantity)
  }

  const variants = await prisma.productVariant.findMany({
    where: { id: { in: [...merged.keys()] } },
    include: { product: { select: { name: true, defaultPrice: true } } },
  })
  const byId = new Map(variants.map((v) => [v.id, v]))

  const lines: QuotePayload['lines'] = []
  let total = 0
  for (const [variantId, quantity] of merged) {
    const variant = byId.get(variantId)
    if (!variant) return { ok: false, error: 'Producto no encontrado' }
    const unitPrice = effectivePrice({ price: toNumber(variant.price) }, { defaultPrice: toNumber(variant.product.defaultPrice) })
    if (unitPrice === null) {
      return { ok: false, error: `${variant.product.name} · ${variant.name} no tiene precio cargado` }
    }
    lines.push({ productName: variant.product.name, variantName: variant.name, unitPrice, quantity })
    total += unitPrice * quantity
  }

  await enqueueQuotePrint({
    lines,
    total,
    customerName: parsed.data.customerName || null,
    issuedAt: new Date().toISOString(),
  })
  return { ok: true }
}
