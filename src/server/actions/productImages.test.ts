import { describe, expect, it, beforeEach, vi } from 'vitest'
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/server/auth/guards', () => ({
  requireRole: vi.fn().mockResolvedValue({ sub: 'admin1', role: 'ADMIN', name: 'Admin', mustChangePassword: false }),
}))
const { uploadImage, deleteImages } = vi.hoisted(() => ({
  uploadImage: vi.fn(async (_file: File, folder: string) => {
    const publicId = `${folder}/${Math.random().toString(36).slice(2)}`
    return { url: `https://res.cloudinary.example/${publicId}.jpg`, publicId }
  }),
  deleteImages: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/server/cloudinary', () => ({ uploadImage, deleteImages }))
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
  uploadImage.mockClear()
  deleteImages.mockClear()
})

describe('addProductImage', () => {
  it('requiere rol ADMIN', async () => {
    await addProductImage(productId, fileFormData())
    expect(vi.mocked((await import('@/server/auth/guards')).requireRole)).toHaveBeenCalledWith('ADMIN')
  })

  it('sube el archivo a Cloudinary y crea la fila con order 0 para la primera foto', async () => {
    const res = await addProductImage(productId, fileFormData())
    expect(res.ok).toBe(true)
    expect(uploadImage).toHaveBeenCalledWith(expect.any(File), `products/${productId}`)
    const rows = await prisma.productImage.findMany({ where: { productId } })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ order: 0 })
    expect(rows[0].pathname).toContain(`products/${productId}/`)
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
    expect(uploadImage).not.toHaveBeenCalled()
  })

  it('rechaza un archivo demasiado pesado', async () => {
    const res = await addProductImage(productId, fileFormData('a.jpg', 'image/jpeg', 6 * 1024 * 1024))
    expect(res).toEqual({ ok: false, error: 'La imagen es demasiado pesada' })
    expect(uploadImage).not.toHaveBeenCalled()
  })

  it('devuelve un error amigable si falla la subida a Cloudinary', async () => {
    uploadImage.mockRejectedValueOnce(new Error('network error'))
    const res = await addProductImage(productId, fileFormData())
    expect(res).toEqual({ ok: false, error: 'No se pudo subir la imagen, probá de nuevo' })
    expect(await prisma.productImage.count({ where: { productId } })).toBe(0)
  })
})

describe('deleteProductImage', () => {
  it('borra la imagen en Cloudinary (por public_id) y la fila, y reordena las restantes sin huecos', async () => {
    await addProductImage(productId, fileFormData('a.jpg'))
    await addProductImage(productId, fileFormData('b.jpg'))
    await addProductImage(productId, fileFormData('c.jpg'))
    const [first, second] = await prisma.productImage.findMany({ where: { productId }, orderBy: { order: 'asc' } })

    const res = await deleteProductImage(first.id)

    expect(res).toEqual({ ok: true })
    expect(deleteImages).toHaveBeenCalledWith([first.pathname])
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
