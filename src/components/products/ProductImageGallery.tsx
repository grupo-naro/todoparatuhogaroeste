'use client'
import { useState, type ChangeEvent } from 'react'
import Image from 'next/image'
import { Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import { addProductImage, deleteProductImage, reorderProductImages } from '@/server/actions/productImages'
import { compressImage } from '@/lib/image-compress'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'

export type GalleryImage = { id: string; url: string; order: number }

export function ProductImageGallery({ productId, images }: { productId: string; images: GalleryImage[] }) {
  const { toast } = useToast()
  const [uploading, setUploading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const sorted = [...images].sort((a, b) => a.order - b.order)

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      const compressed = await compressImage(file)
      const formData = new FormData()
      formData.set('file', compressed)
      const res = await addProductImage(productId, formData)
      if (!res.ok) toast(res.error, 'danger')
    } catch {
      toast('No se pudo subir la imagen, probá de nuevo', 'danger')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(id: string) {
    setBusyId(id)
    try {
      const res = await deleteProductImage(id)
      if (!res.ok) toast(res.error, 'danger')
    } catch {
      toast('No se pudo borrar la imagen, probá de nuevo', 'danger')
    } finally {
      setBusyId(null)
    }
  }

  async function handleMove(id: string, direction: -1 | 1) {
    const idx = sorted.findIndex((img) => img.id === id)
    const swapWith = idx + direction
    if (swapWith < 0 || swapWith >= sorted.length) return
    const order = sorted.map((img) => img.id)
    ;[order[idx], order[swapWith]] = [order[swapWith], order[idx]]
    setBusyId(id)
    try {
      const res = await reorderProductImages(productId, order)
      if (!res.ok) toast(res.error, 'danger')
    } catch {
      toast('No se pudo reordenar las imágenes, probá de nuevo', 'danger')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-medium">Fotos</h2>
      {sorted.length === 0 && <p className="text-sm text-muted">Sin fotos todavía</p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {sorted.map((img, i) => (
          <div key={img.id} className="relative flex flex-col gap-1 rounded border border-border p-2">
            <div className="relative aspect-square overflow-hidden rounded bg-border/30">
              <Image src={img.url} alt="" fill sizes="(min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw" className="object-cover" />
              {i === 0 && (
                <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
                  Portada
                </span>
              )}
            </div>
            <div className="flex items-center justify-between gap-1">
              <Button
                type="button" variant="ghost" size="sm" disabled={busyId === img.id || i === 0}
                onClick={() => handleMove(img.id, -1)} aria-label="Mover antes"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                type="button" variant="ghost" size="sm" disabled={busyId === img.id || i === sorted.length - 1}
                onClick={() => handleMove(img.id, 1)} aria-label="Mover después"
              >
                <ChevronRight className="size-4" />
              </Button>
              <Button
                type="button" variant="danger" size="sm" disabled={busyId === img.id}
                onClick={() => handleDelete(img.id)} aria-label="Eliminar foto"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
      <label className="flex w-full max-w-xs flex-col gap-1">
        <span className="text-sm">Agregar foto</span>
        <input
          aria-label="Agregar foto"
          type="file"
          accept="image/*"
          disabled={uploading}
          onChange={handleFileChange}
          className="text-sm"
        />
      </label>
      {uploading && <p className="text-sm text-muted">Subiendo…</p>}
    </div>
  )
}
