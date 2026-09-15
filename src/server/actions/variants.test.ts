import { describe, expect, it, beforeEach, vi } from 'vitest'
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/server/auth/guards', () => ({
  requireUser: vi.fn(),
}))
import { prisma, resetDb } from '@/test/db'
import { createVariant, deleteVariant } from './variants'

let productId: string, userId: string
beforeEach(async () => {
  await resetDb()
  userId = (await prisma.user.create({ data: { email: 'u@u.com', name: 'U', passwordHash: 'x' } })).id
  vi.mocked((await import('@/server/auth/guards')).requireUser).mockResolvedValue({ sub: userId, role: 'DEPOSITO', name: 'U', mustChangePassword: false })
  const c = await prisma.category.create({ data: { name: 'Mesas', slug: 'mesas' } })
  const p = await prisma.product.create({
    data: { name: 'Mesa', categoryId: c.id, variants: { create: [{ name: 'Única', isDefault: true }] } },
  })
  productId = p.id
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
  it('SKU vacío ("") en varias variantes no colisiona — se guarda como null', async () => {
    expect((await createVariant(productId, { name: 'V1', sku: '' })).ok).toBe(true)
    expect((await createVariant(productId, { name: 'V2', sku: '' })).ok).toBe(true)
  })
  it('con stockInicial crea el InventoryStock y una transacción CARGA_INICIAL', async () => {
    const res = await createVariant(productId, { color: 'Rojo', stockInicial: 7 })
    expect(res.ok).toBe(true)
    const id = (res as { ok: true; id: string }).id
    expect(await prisma.inventoryStock.findUniqueOrThrow({ where: { variantId: id } })).toMatchObject({ quantity: 7 })
    const t = await prisma.inventoryTransaction.findFirstOrThrow({ where: { variantId: id } })
    expect(t).toMatchObject({ type: 'CARGA_INICIAL', quantityDelta: 7, quantityAfter: 7, userId })
  })
  it('sin stockInicial no crea InventoryStock', async () => {
    const res = await createVariant(productId, { color: 'Verde' })
    const id = (res as { ok: true; id: string }).id
    expect(await prisma.inventoryStock.findUnique({ where: { variantId: id } })).toBeNull()
  })
})

describe('deleteVariant', () => {
  it('rechaza si tiene stock', async () => {
    const v = await prisma.productVariant.create({ data: { productId, name: 'V2' } })
    await prisma.inventoryStock.create({ data: { variantId: v.id, quantity: 3 } })
    expect(await deleteVariant(v.id)).toEqual({ ok: false, error: 'La variante tiene stock' })
    expect(await prisma.productVariant.findUnique({ where: { id: v.id } })).not.toBeNull()
  })
  it('rechaza si tiene movimientos', async () => {
    const v = await prisma.productVariant.create({ data: { productId, name: 'V3' } })
    await prisma.inventoryTransaction.create({
      data: { variantId: v.id, type: 'CARGA_INICIAL', quantityDelta: 0, quantityAfter: 0, userId },
    })
    expect(await deleteVariant(v.id)).toEqual({ ok: false, error: 'La variante tiene movimientos registrados' })
    expect(await prisma.productVariant.findUnique({ where: { id: v.id } })).not.toBeNull()
  })
  it('rechaza eliminar la última variante activa', async () => {
    const only = await prisma.productVariant.findFirstOrThrow({ where: { productId } })
    expect(await deleteVariant(only.id)).toEqual({ ok: false, error: 'El producto debe tener al menos una variante' })
  })
  it('elimina una variante extra sin stock ni movimientos', async () => {
    const v = await prisma.productVariant.create({ data: { productId, name: 'V4' } })
    expect(await deleteVariant(v.id)).toEqual({ ok: true, id: v.id })
    expect(await prisma.productVariant.findUnique({ where: { id: v.id } })).toBeNull()
  })
})
