import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const { createCategory } = vi.hoisted(() => ({ createCategory: vi.fn().mockResolvedValue({ ok: true }) }))
vi.mock('@/server/actions/categories', () => ({ createCategory, updateCategory: vi.fn(), archiveCategory: vi.fn() }))
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
import { CategoryManager } from './CategoryManager'

describe('CategoryManager', () => {
  it('muestra las categorías recibidas', () => {
    render(<CategoryManager categories={[{ id: '1', name: 'Mesas', slug: 'mesas', activeProductCount: 3, archivedAt: null, createdAt: new Date(), updatedAt: new Date() }]} />)
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
})
