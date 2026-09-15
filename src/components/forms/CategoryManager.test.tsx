import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const { createCategory, deleteCategory } = vi.hoisted(() => ({
  createCategory: vi.fn().mockResolvedValue({ ok: true }),
  deleteCategory: vi.fn().mockResolvedValue({ ok: true }),
}))
vi.mock('@/server/actions/categories', () => ({ createCategory, updateCategory: vi.fn(), deleteCategory }))
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
import { CategoryManager } from './CategoryManager'

const cats = [{ id: '1', name: 'Mesas', slug: 'mesas', activeProductCount: 3, createdAt: new Date(), updatedAt: new Date() }]

describe('CategoryManager', () => {
  it('muestra las categorías recibidas', () => {
    render(<CategoryManager categories={cats} />)
    expect(screen.getByText('Mesas')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })
  it('envía el alta con el nombre tipeado', async () => {
    render(<CategoryManager categories={[]} />)
    await userEvent.type(screen.getByLabelText('Nueva categoría'), 'Sillas')
    await userEvent.click(screen.getByRole('button', { name: 'Agregar' }))
    expect(createCategory).toHaveBeenCalled()
    const formData = createCategory.mock.calls[0][1] as FormData
    expect(formData.get('name')).toBe('Sillas')
  })
  it('pide confirmación antes de eliminar, y no elimina si se cancela', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<CategoryManager categories={cats} />)
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }))
    expect(deleteCategory).not.toHaveBeenCalled()
  })
  it('elimina la categoría si se confirma', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<CategoryManager categories={cats} />)
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }))
    expect(deleteCategory).toHaveBeenCalledWith('1')
  })
})
