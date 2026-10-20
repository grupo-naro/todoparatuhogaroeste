import { describe, expect, it, beforeEach, vi } from 'vitest'
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/server/auth/guards', () => ({
  requireRole: vi.fn().mockResolvedValue({ sub: 'u1', role: 'ADMIN', name: 'A' }),
}))
const { del } = vi.hoisted(() => ({ del: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/server/cloudinary', () => ({ deleteImages: del }))
import { prisma, resetDb } from '@/test/db'
import { createProduct, deleteProduct, updateProduct } from './products'
import { requireRole } from '@/server/auth/guards'

let categoryId: string, userId: string
beforeEach(async () => {
  await resetDb()
  userId = (await prisma.user.create({ data: { email: 'a@a.com', name: 'Ana', passwordHash: 'x' } })).id
  vi.mocked(requireRole).mockResolvedValue({ sub: userId, role: 'DEPOSITO', name: 'Ana', mustChangePassword: false })
  categoryId = (await prisma.category.create({ data: { name: 'Mesas', slug: 'mesas' } })).id
  del.mockClear()
})

describe('createProduct', () => {
  it('sin variantes crea una variante "Única" isDefault', async () => {
    const res = await createProduct({ name: 'Mesa Roble', categoryId, defaultCost: 50, defaultPrice: 120 })
    expect(res.ok).toBe(true)
    const p = await prisma.product.findFirstOrThrow({ include: { variants: true } })
    expect(p.variants).toHaveLength(1)
    expect(p.variants[0]).toMatchObject({ name: 'Única', isDefault: true })
  })
  it('con stockInicial crea el InventoryStock y una transacción CARGA_INICIAL', async () => {
    await createProduct({
      name: 'Respaldo Rojo', categoryId,
      variants: [{ color: 'Rojo', stockInicial: 5 }],
    })
    const v = await prisma.productVariant.findFirstOrThrow()
    expect(await prisma.inventoryStock.findUniqueOrThrow({ where: { variantId: v.id } }))
      .toMatchObject({ quantity: 5 })
    const t = await prisma.inventoryTransaction.findFirstOrThrow({ where: { variantId: v.id } })
    expect(t).toMatchObject({ type: 'CARGA_INICIAL', quantityDelta: 5, quantityAfter: 5, userId })
  })
  it('stockInicial en 0 explícito igual crea el stock y la transacción', async () => {
    await createProduct({ name: 'Respaldo Cero', categoryId, variants: [{ color: 'Azul', stockInicial: 0 }] })
    const v = await prisma.productVariant.findFirstOrThrow()
    expect(await prisma.inventoryStock.findUniqueOrThrow({ where: { variantId: v.id } }))
      .toMatchObject({ quantity: 0 })
    expect(await prisma.inventoryTransaction.count({ where: { variantId: v.id } })).toBe(1)
  })
  it('sin stockInicial no crea InventoryStock', async () => {
    await createProduct({ name: 'Respaldo Sin Stock', categoryId, variants: [{ color: 'Verde' }] })
    const v = await prisma.productVariant.findFirstOrThrow()
    expect(await prisma.inventoryStock.findUnique({ where: { variantId: v.id } })).toBeNull()
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
  it('SKU vacío ("") en varias variantes no colisiona — se guarda como null', async () => {
    const res = await createProduct({
      name: 'Respaldo', categoryId,
      variants: [
        { medida: '1.40 cm', color: 'Negro', sku: '' },
        { medida: '1.40 cm', color: 'Gris', sku: '' },
        { medida: '1.40 cm', color: 'Verde', sku: '' },
        { medida: '1.40 cm', color: 'Rosa', sku: '' },
      ],
    })
    expect(res.ok).toBe(true)
    const variants = await prisma.productVariant.findMany({ where: { product: { name: 'Respaldo' } } })
    expect(variants).toHaveLength(4)
    expect(variants.every((v) => v.sku === null)).toBe(true)
  })
  it('rechaza dos variantes con el mismo SKU real, con mensaje específico de SKU', async () => {
    expect(await createProduct({
      name: 'Sillón Z', categoryId,
      variants: [{ color: 'Negro', sku: 'ABC' }, { color: 'Gris', sku: 'ABC' }],
    })).toEqual({ ok: false, error: 'Hay variantes con el mismo SKU' })
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
  it('exige rol ADMIN o DEPOSITO', async () => {
    await createProduct({ name: 'Mesa Roble', categoryId })
    expect(requireRole).toHaveBeenCalledWith(['ADMIN', 'DEPOSITO'])
  })
})

describe('updateProduct', () => {
  it('actualiza el producto', async () => {
    const { id } = await createProduct({ name: 'Mesa Roble', categoryId }) as { ok: true; id: string }
    const res = await updateProduct(id, { name: 'Mesa Roble Actualizada', categoryId })
    expect(res.ok).toBe(true)
    const p = await prisma.product.findUniqueOrThrow({ where: { id } })
    expect(p.name).toBe('Mesa Roble Actualizada')
  })
  it('exige rol ADMIN o DEPOSITO', async () => {
    const { id } = await createProduct({ name: 'Mesa Roble', categoryId }) as { ok: true; id: string }
    vi.mocked(requireRole).mockClear()
    await updateProduct(id, { name: 'Mesa Actualizada', categoryId })
    expect(requireRole).toHaveBeenCalledWith(['ADMIN', 'DEPOSITO'])
  })
})

describe('deleteProduct', () => {
  it('elimina el producto y sus variantes', async () => {
    const { id } = await createProduct({ name: 'Mesa Roble', categoryId }) as { ok: true; id: string }
    expect(await deleteProduct(id)).toEqual({ ok: true, id })
    expect(await prisma.product.findUnique({ where: { id } })).toBeNull()
    expect(await prisma.productVariant.count({ where: { productId: id } })).toBe(0)
  })

  it('rechaza si alguna variante tiene stock', async () => {
    const { id } = await createProduct({ name: 'Mesa Roble', categoryId }) as { ok: true; id: string }
    const v = await prisma.productVariant.findFirstOrThrow({ where: { productId: id } })
    await prisma.inventoryStock.create({ data: { variantId: v.id, quantity: 5 } })
    expect(await deleteProduct(id))
      .toEqual({ ok: false, error: 'El producto tiene variantes con stock o movimientos registrados' })
    expect(await prisma.product.findUnique({ where: { id } })).not.toBeNull()
  })

  it('rechaza si alguna variante tiene movimientos', async () => {
    const { id } = await createProduct({ name: 'Mesa Roble', categoryId }) as { ok: true; id: string }
    const v = await prisma.productVariant.findFirstOrThrow({ where: { productId: id } })
    await prisma.inventoryTransaction.create({
      data: { variantId: v.id, type: 'CARGA_INICIAL', quantityDelta: 0, quantityAfter: 0, userId },
    })
    expect(await deleteProduct(id))
      .toEqual({ ok: false, error: 'El producto tiene variantes con stock o movimientos registrados' })
  })

  it('borra las fotos del producto en Cloudinary antes de eliminarlo', async () => {
    const { id } = await createProduct({ name: 'Mesa Roble', categoryId }) as { ok: true; id: string }
    await prisma.productImage.create({ data: { productId: id, url: 'https://blob.example/a.jpg', pathname: 'a', order: 0 } })
    await prisma.productImage.create({ data: { productId: id, url: 'https://blob.example/b.jpg', pathname: 'b', order: 1 } })
    expect(await deleteProduct(id)).toEqual({ ok: true, id })
    expect(del).toHaveBeenCalledWith(['a', 'b'])
  })

  it('sin fotos no llama a del()', async () => {
    const { id } = await createProduct({ name: 'Mesa Roble', categoryId }) as { ok: true; id: string }
    await deleteProduct(id)
    expect(del).not.toHaveBeenCalled()
  })

  it('exige rol ADMIN o DEPOSITO', async () => {
    const { id } = await createProduct({ name: 'Mesa Roble', categoryId }) as { ok: true; id: string }
    vi.mocked(requireRole).mockClear()
    await deleteProduct(id)
    expect(requireRole).toHaveBeenCalledWith(['ADMIN', 'DEPOSITO'])
  })
})
