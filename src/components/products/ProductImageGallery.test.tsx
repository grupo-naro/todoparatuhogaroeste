import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const { addProductImage, deleteProductImage, reorderProductImages, compressImage } = vi.hoisted(() => ({
  addProductImage: vi.fn().mockResolvedValue({ ok: true, id: 'img-new' }),
  deleteProductImage: vi.fn().mockResolvedValue({ ok: true }),
  reorderProductImages: vi.fn().mockResolvedValue({ ok: true }),
  compressImage: vi.fn(async (f: File) => f),
}))
vi.mock('@/server/actions/productImages', () => ({ addProductImage, deleteProductImage, reorderProductImages }))
vi.mock('@/lib/image-compress', () => ({ compressImage }))
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
import { ProductImageGallery } from './ProductImageGallery'

const images = [
  { id: 'i1', url: 'https://blob.example/i1.jpg', order: 0 },
  { id: 'i2', url: 'https://blob.example/i2.jpg', order: 1 },
]

describe('ProductImageGallery', () => {
  it('muestra "Sin fotos todavía" cuando no hay imágenes', () => {
    render(<ProductImageGallery productId="p1" images={[]} />)
    expect(screen.getByText('Sin fotos todavía')).toBeInTheDocument()
  })

  it('marca la primera imagen (order 0) como portada', () => {
    render(<ProductImageGallery productId="p1" images={images} />)
    expect(screen.getByText('Portada')).toBeInTheDocument()
  })

  it('comprime y sube el archivo elegido', async () => {
    render(<ProductImageGallery productId="p1" images={[]} />)
    const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' })
    await userEvent.upload(screen.getByLabelText('Agregar foto'), file)
    expect(compressImage).toHaveBeenCalledWith(file)
    expect(addProductImage).toHaveBeenCalledWith('p1', expect.any(FormData))
  })

  it('borra una imagen al hacer click en "Eliminar foto"', async () => {
    render(<ProductImageGallery productId="p1" images={images} />)
    await userEvent.click(screen.getAllByRole('button', { name: 'Eliminar foto' })[0])
    expect(deleteProductImage).toHaveBeenCalledWith('i1')
  })

  it('mueve una imagen con el botón "Mover después"', async () => {
    render(<ProductImageGallery productId="p1" images={images} />)
    await userEvent.click(screen.getAllByRole('button', { name: 'Mover después' })[0])
    expect(reorderProductImages).toHaveBeenCalledWith('p1', ['i2', 'i1'])
  })

  it('el botón "Mover antes" está deshabilitado en la primera imagen', () => {
    render(<ProductImageGallery productId="p1" images={images} />)
    expect(screen.getAllByRole('button', { name: 'Mover antes' })[0]).toBeDisabled()
  })
})
