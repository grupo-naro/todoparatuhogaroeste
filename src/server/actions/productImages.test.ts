import { describe, expect, it, beforeEach, vi } from 'vitest'
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/server/auth/guards', () => ({
  requireRole: vi.fn().mockResolvedValue({ sub: 'admin1', role: 'ADMIN', name: 'Admin', mustChangePassword: false }),
}))
const { put, del } = vi.hoisted(() => ({
  put: vi.fn(async (pathname: string) => ({ url: `https://blob.example/${pathname}`, pathname })),
  del: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@vercel/blob', () => ({ put, del }))
import { prisma, resetDb } from '@/test/db'
import { addProductImage, deleteProductImage, reorderProductImages } from './productImages'

function fileFormData(name = 'a.jpg', type = 'image/jpeg', size = 1024): FormData {
  const fd = new FormData()
  fd.set('file', new File([new Uint8Array(size)], name, { type }))
  return fd
}

let productId: string
beforeEach(async () => {
  await resetDb()
  const c = await prisma.category.create({ data: { name: 'Mesas', slug: 'mesas' } })
  const p = await prisma.product.create({ data: { name: 'Mesa', categoryId: c.id } })
  productId = p.id
  put.mockClear()
  del.mockClear()
})

describe('addProductImage', () => {
  it('requiere rol ADMIN', async () => {
    await addProductImage(productId, fileFormData())
    expect(vi.mocked((await import('@/server/auth/guards')).requireRole)).toHaveBeenCalledWith('ADMIN')
  })

  it('sube el archivo a Blob y crea la fila con order 0 para la primera foto', async () => {
    const res = await addProductImage(productId, fileFormData())
    expect(res.ok).toBe(true)
    expect(put).toHaveBeenCalledWith(
      expect.stringContaining(`products/${productId}/`),
      expect.any(File),
      { access: 'public' },
    )
    const rows = await prisma.productImage.findMany({ where: { productId } })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ order: 0 })
  })

  it('asigna order consecutivo a la segunda foto', async () => {
    await addProductImage(productId, fileFormData('a.jpg'))
    await addProductImage(productId, fileFormData('b.jpg'))
    const rows = await prisma.productImage.findMany({ where: { productId }, orderBy: { order: 'asc' } })
    expect(rows.map((r) => r.order)).toEqual([0, 1])
  })

  it('rechaza un tipo de archivo no permitido', async () => {
    const res = await addProductImage(productId, fileFormData('a.gif', 'image/gif'))
    expect(res).toEqual({ ok: false, error: 'El archivo debe ser una imagen (JPG, PNG o WebP)' })
    expect(put).not.toHaveBeenCalled()
  })

  it('rechaza un archivo demasiado pesado', async () => {
    const res = await addProductImage(productId, fileFormData('a.jpg', 'image/jpeg', 6 * 1024 * 1024))
    expect(res).toEqual({ ok: false, error: 'La imagen es demasiado pesada' })
    expect(put).not.toHaveBeenCalled()
  })

  it('devuelve un error amigable si falla la subida a Blob', async () => {
    put.mockRejectedValueOnce(new Error('network error'))
    const res = await addProductImage(productId, fileFormData())
    expect(res).toEqual({ ok: false, error: 'No se pudo subir la imagen, probá de nuevo' })
    expect(await prisma.productImage.count({ where: { productId } })).toBe(0)
  })
})

describe('deleteProductImage', () => {
  it('borra el blob (por url) y la fila, y reordena las restantes sin huecos', async () => {
    await addProductImage(productId, fileFormData('a.jpg'))
    await addProductImage(productId, fileFormData('b.jpg'))
    await addProductImage(productId, fileFormData('c.jpg'))
    const [first, second] = await prisma.productImage.findMany({ where: { productId }, orderBy: { order: 'asc' } })

    const res = await deleteProductImage(first.id)

    expect(res).toEqual({ ok: true })
    expect(del).toHaveBeenCalledWith(first.url)
    const remaining = await prisma.productImage.findMany({ where: { productId }, orderBy: { order: 'asc' } })
    expect(remaining.map((r) => r.order)).toEqual([0, 1])
    expect(remaining[0].id).toBe(second.id)
  })
})

describe('reorderProductImages', () => {
  it('reordena y permite mover una imagen a portada (order 0)', async () => {
    await addProductImage(productId, fileFormData('a.jpg'))
    await addProductImage(productId, fileFormData('b.jpg'))
    const [first, second] = await prisma.productImage.findMany({ where: { productId }, orderBy: { order: 'asc' } })

    const res = await reorderProductImages(productId, [second.id, first.id])

    expect(res).toEqual({ ok: true })
    const rows = await prisma.productImage.findMany({ where: { productId }, orderBy: { order: 'asc' } })
    expect(rows.map((r) => r.id)).toEqual([second.id, first.id])
  })

  it('rechaza si la lista de ids no coincide con las imágenes actuales', async () => {
    await addProductImage(productId, fileFormData('a.jpg'))
    const res = await reorderProductImages(productId, ['id-inexistente'])
    expect(res).toEqual({ ok: false, error: 'La lista de imágenes no coincide con las actuales' })
  })

  it('rechaza una lista con ids duplicados aunque el tamaño coincida', async () => {
    await addProductImage(productId, fileFormData('a.jpg'))
    await addProductImage(productId, fileFormData('b.jpg'))
    const [first] = await prisma.productImage.findMany({ where: { productId }, orderBy: { order: 'asc' } })

    const res = await reorderProductImages(productId, [first.id, first.id])

    expect(res).toEqual({ ok: false, error: 'La lista de imágenes no coincide con las actuales' })
  })
})
