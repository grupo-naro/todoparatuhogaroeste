import { describe, expect, it, beforeEach, vi } from 'vitest'
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/server/auth/guards', () => ({
  requireUser: vi.fn().mockResolvedValue({ sub: 'u1', role: 'DEPOSITO', name: 'A' }),
  requireRole: vi.fn().mockResolvedValue({ sub: 'u1', role: 'ADMIN', name: 'A' }),
}))
import { prisma, resetDb } from '@/test/db'
import { createProduct, archiveProduct } from './products'

let categoryId: string
beforeEach(async () => {
  await resetDb()
  categoryId = (await prisma.category.create({ data: { name: 'Mesas', slug: 'mesas' } })).id
})

describe('createProduct', () => {
  it('sin variantes crea una variante "Única" isDefault', async () => {
    const res = await createProduct({ name: 'Mesa Roble', categoryId, defaultCost: 50, defaultPrice: 120 })
    expect(res.ok).toBe(true)
    const p = await prisma.product.findFirstOrThrow({ include: { variants: true } })
    expect(p.variants).toHaveLength(1)
    expect(p.variants[0]).toMatchObject({ name: 'Única', isDefault: true })
  })
  it('con variantes autogenera el nombre desde medida/tela/color', async () => {
    await createProduct({
      name: 'Sillón X', categoryId,
      variants: [{ medida: '2 cuerpos', tela: 'Chenille', color: 'Gris', price: 300 }],
    })
    const v = await prisma.productVariant.findFirstOrThrow()
    expect(v.name).toBe('2 cuerpos · Chenille · Gris')
    expect(v.price?.toString()).toBe('300')
  })
  it('rechaza dos variantes con el mismo nombre en el mismo producto', async () => {
    expect(await createProduct({
      name: 'Sillón Y', categoryId,
      variants: [{ name: 'Estándar' }, { name: 'Estándar' }],
    })).toEqual({ ok: false, error: 'Hay variantes con el mismo nombre' })
    expect(await prisma.product.count()).toBe(0) // tx rolled back, no orphan product
  })
  it('rechaza nombre de producto duplicado en la misma categoría', async () => {
    await createProduct({ name: 'Mesa Roble', categoryId })
    expect(await createProduct({ name: 'Mesa Roble', categoryId }))
      .toEqual({ ok: false, error: 'Ya existe un producto con ese nombre en la categoría' })
    // Interactive $transaction must have rolled back: no orphan Product row
    // (and no partial Product without its variant) from the failed second call.
    expect(await prisma.product.count()).toBe(1)
    expect(await prisma.productVariant.count()).toBe(1)
  })
})

describe('archiveProduct', () => {
  it('archiva el producto y sus variantes', async () => {
    const { id } = await createProduct({ name: 'Mesa Roble', categoryId }) as { ok: true; id: string }
    expect(await archiveProduct(id)).toEqual({ ok: true, id })
    const p = await prisma.product.findUniqueOrThrow({ where: { id }, include: { variants: true } })
    expect(p.archivedAt).not.toBeNull()
    expect(p.variants.every((v) => v.archivedAt !== null)).toBe(true)
  })
})
