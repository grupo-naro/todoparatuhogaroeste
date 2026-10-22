import { describe, expect, it, beforeEach, vi } from 'vitest'
vi.mock('@/server/auth/guards', () => ({
  requireRole: vi.fn().mockResolvedValue({ sub: 'U', role: 'VENDEDOR', name: 'Ana', mustChangePassword: false }),
}))
import { prisma, resetDb } from '@/test/db'
import { enqueueQuote } from './quotes'
import type { QuotePayload } from '@/server/printing/queue'

let v1: string, vSinPrecio: string

beforeEach(async () => {
  await resetDb()
  const c = await prisma.category.create({ data: { name: 'Mesas', slug: 'mesas' } })
  const p = await prisma.product.create({
    data: {
      name: 'Mesa', categoryId: c.id,
      variants: { create: [{ name: 'A', price: 100 }, { name: 'Sin precio' }] },
    },
    include: { variants: true },
  })
  v1 = p.variants.find((v) => v.name === 'A')!.id
  vSinPrecio = p.variants.find((v) => v.name === 'Sin precio')!.id
})

describe('enqueueQuote', () => {
  it('guarda el presupuesto con los precios de la base aunque el input traiga otros', async () => {
    const res = await enqueueQuote({ items: [{ variantId: v1, quantity: 2, unitPrice: 1 }], customerName: ' Ana ' })
    expect(res).toEqual({ ok: true })
    const jobs = await prisma.printJob.findMany()
    expect(jobs).toHaveLength(1)
    const payload = jobs[0].payload as QuotePayload
    expect(jobs[0].kind).toBe('PRESUPUESTO')
    expect(payload.lines).toEqual([{ productName: 'Mesa', variantName: 'A', unitPrice: 100, quantity: 2 }])
    expect(payload.total).toBe(200)
    expect(payload.customerName).toBe('Ana')
    expect(Number.isNaN(Date.parse(payload.issuedAt))).toBe(false)
  })

  it('rechaza una línea sin precio y no encola nada', async () => {
    const res = await enqueueQuote({ items: [{ variantId: v1, quantity: 1 }, { variantId: vSinPrecio, quantity: 1 }] })
    expect(res).toEqual({ ok: false, error: 'Mesa · Sin precio no tiene precio cargado' })
    expect(await prisma.printJob.count()).toBe(0)
  })

  it('rechaza cantidad 0 o negativa', async () => {
    expect((await enqueueQuote({ items: [{ variantId: v1, quantity: 0 }] })).ok).toBe(false)
    expect((await enqueueQuote({ items: [{ variantId: v1, quantity: -2 }] })).ok).toBe(false)
    expect(await prisma.printJob.count()).toBe(0)
  })

  it('rechaza una variante inexistente', async () => {
    const res = await enqueueQuote({ items: [{ variantId: '00000000-0000-0000-0000-000000000000', quantity: 1 }] })
    expect(res).toEqual({ ok: false, error: 'Producto no encontrado' })
  })

  it('exige rol ADMIN o VENDEDOR', async () => {
    await enqueueQuote({ items: [{ variantId: v1, quantity: 1 }] })
    expect(vi.mocked((await import('@/server/auth/guards')).requireRole)).toHaveBeenCalledWith(['ADMIN', 'VENDEDOR'])
  })
})

describe('enqueueQuote — dirección de envío', () => {
  it('guarda la dirección recortada en el payload', async () => {
    await enqueueQuote({ items: [{ variantId: v1, quantity: 1 }], shippingAddress: ' Av. Siempreviva 742 ' })
    const payload = (await prisma.printJob.findFirstOrThrow()).payload as QuotePayload
    expect(payload.shippingAddress).toBe('Av. Siempreviva 742')
  })

  it('sin dirección el payload tiene null', async () => {
    await enqueueQuote({ items: [{ variantId: v1, quantity: 1 }] })
    const payload = (await prisma.printJob.findFirstOrThrow()).payload as QuotePayload
    expect(payload.shippingAddress).toBeNull()
  })

  it('rechaza una dirección de más de 200 caracteres', async () => {
    const res = await enqueueQuote({ items: [{ variantId: v1, quantity: 1 }], shippingAddress: 'x'.repeat(201) })
    expect(res.ok).toBe(false)
    expect(await prisma.printJob.count()).toBe(0)
  })
})
