'use server'
import { revalidatePath } from 'next/cache'
import { uploadImage, deleteImages } from '@/server/cloudinary'
import { prisma } from '@/server/db'
import { requireRole } from '@/server/auth/guards'
import type { SaveResult } from './products'

export type { SaveResult }
export type ActionResult = { ok: true } | { ok: false; error: string }

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

function revalidateProduct(productId: string) {
  revalidatePath(`/productos/${productId}`)
  revalidatePath('/productos')
}

export async function addProductImage(productId: string, formData: FormData): Promise<SaveResult> {
  await requireRole('ADMIN')
  const file = formData.get('file')
  if (!(file instanceof File)) return { ok: false, error: 'No se recibió ningún archivo' }
  if (!ALLOWED_MIME.has(file.type)) return { ok: false, error: 'El archivo debe ser una imagen (JPG, PNG o WebP)' }
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: 'La imagen es demasiado pesada' }

  let uploaded: { url: string; publicId: string }
  try {
    uploaded = await uploadImage(file, `products/${productId}`)
  } catch (err) {
    console.error('addProductImage: la subida a Cloudinary falló', err)
    return { ok: false, error: 'No se pudo subir la imagen, probá de nuevo' }
  }

  const created = await prisma.$transaction(async (tx) => {
    const agg = await tx.productImage.aggregate({ where: { productId }, _max: { order: true } })
    const order = (agg._max.order ?? -1) + 1
    return tx.productImage.create({ data: { productId, url: uploaded.url, pathname: uploaded.publicId, order } })
  })
  revalidateProduct(productId)
  return { ok: true, id: created.id }
}

export async function deleteProductImage(imageId: string): Promise<ActionResult> {
  await requireRole('ADMIN')
  const image = await prisma.productImage.findUniqueOrThrow({ where: { id: imageId } })
  await deleteImages([image.pathname])
  await prisma.$transaction(async (tx) => {
    await tx.productImage.delete({ where: { id: imageId } })
    // Solo se borró una fila, así que a lo sumo las que quedan después del
    // hueco necesitan bajar un lugar (nunca subir ni chocar entre sí) — no
    // hace falta el truco de dos pasadas que sí necesita `reorderProductImages`.
    const remaining = await tx.productImage.findMany({
      where: { productId: image.productId },
      orderBy: { order: 'asc' },
    })
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i].order !== i) await tx.productImage.update({ where: { id: remaining[i].id }, data: { order: i } })
    }
  })
  revalidateProduct(image.productId)
  return { ok: true }
}

export async function reorderProductImages(productId: string, orderedImageIds: string[]): Promise<ActionResult> {
  await requireRole('ADMIN')
  const current = await prisma.productImage.findMany({ where: { productId }, select: { id: true } })
  const currentIds = new Set(current.map((i) => i.id))
  const matches = orderedImageIds.length === currentIds.size
    && new Set(orderedImageIds).size === orderedImageIds.length
    && orderedImageIds.every((id) => currentIds.has(id))
  if (!matches) return { ok: false, error: 'La lista de imágenes no coincide con las actuales' }

  await prisma.$transaction(async (tx) => {
    // Dos pasadas para no chocar contra `@@unique([productId, order])`:
    // primero valores negativos únicos, después los finales.
    for (let i = 0; i < orderedImageIds.length; i++) {
      await tx.productImage.update({ where: { id: orderedImageIds[i] }, data: { order: -(i + 1) } })
    }
    for (let i = 0; i < orderedImageIds.length; i++) {
      await tx.productImage.update({ where: { id: orderedImageIds[i] }, data: { order: i } })
    }
  })
  revalidateProduct(productId)
  return { ok: true }
}
