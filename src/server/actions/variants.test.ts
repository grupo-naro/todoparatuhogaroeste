import { describe, expect, it, beforeEach, vi } from 'vitest'
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/server/auth/guards', () => ({
  requireUser: vi.fn().mockResolvedValue({ sub: 'u1', role: 'DEPOSITO', name: 'A' }),
}))
import { prisma, resetDb } from '@/test/db'
import { createVariant, archiveVariant } from './variants'

let productId: string, userId: string
beforeEach(async () => {
  await resetDb()
  const c = await prisma.category.create({ data: { name: 'Mesas', slug: 'mesas' } })
  const p = await prisma.product.create({
    data: { name: 'Mesa', categoryId: c.id, variants: { create: [{ name: 'Única', isDefault: true }] } },
  })
  productId = p.id
  userId = (await prisma.user.create({ data: { email: 'u@u.com', name: 'U', passwordHash: 'x' } })).id
})

describe('createVariant', () => {
  it('autogenera nombre y crea la variante', async () => {
    const res = await createVariant(productId, { medida: '1,40m', color: 'Roble' })
    expect(res.ok).toBe(true)
    expect(await prisma.productVariant.findFirst({ where: { name: '1,40m · Roble' } })).not.toBeNull()
  })
  it('rechaza nombre duplicado en el producto', async () => {
    expect(await createVariant(productId, { name: 'Única' }))
      .toEqual({ ok: false, error: 'Ya existe una variante con ese nombre en el producto' })
  })
  it('rechaza SKU duplicado', async () => {
    expect((await createVariant(productId, { name: 'Con SKU', sku: 'ABC' })).ok).toBe(true)
    expect(await createVariant(productId, { name: 'Otra', sku: 'ABC' }))
      .toEqual({ ok: false, error: 'Ya existe una variante con ese SKU' })
  })
})

describe('archiveVariant', () => {
  it('rechaza si tiene stock', async () => {
    const v = await prisma.productVariant.create({ data: { productId, name: 'V2' } })
    await prisma.inventoryStock.create({ data: { variantId: v.id, quantity: 3 } })
    expect(await archiveVariant(v.id)).toEqual({ ok: false, error: 'La variante tiene stock' })
  })
  it('rechaza si tiene movimientos', async () => {
    const v = await prisma.productVariant.create({ data: { productId, name: 'V3' } })
    await prisma.inventoryTransaction.create({
      data: { variantId: v.id, type: 'CARGA_INICIAL', quantityDelta: 0, quantityAfter: 0, userId },
    })
    expect(await archiveVariant(v.id)).toEqual({ ok: false, error: 'La variante tiene movimientos registrados' })
  })
  it('rechaza archivar la última variante activa', async () => {
    const only = await prisma.productVariant.findFirstOrThrow({ where: { productId } })
    expect(await archiveVariant(only.id)).toEqual({ ok: false, error: 'El producto debe tener al menos una variante' })
  })
  it('archiva una variante extra sin stock ni movimientos', async () => {
    const v = await prisma.productVariant.create({ data: { productId, name: 'V4' } })
    expect(await archiveVariant(v.id)).toMatchObject({ ok: true })
  })
})
