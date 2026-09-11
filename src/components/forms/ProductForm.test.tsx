import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// `createProduct` is dereferenced directly inside the `@/server/actions/products`
// factory (as an object property, not inside a nested closure), so it needs
// `vi.hoisted` to escape the TDZ that `vi.mock`'s hoisting-to-top-of-file would
// otherwise put it in — same fix `CategoryManager.test.tsx` already uses for
// `createCategory`. `push` doesn't need it: it's only read lazily inside the
// `useRouter: () => ({ push })` closure, well after the module has finished
// initializing (see `ProductFilters.test.tsx`, which uses the plain form).
const { createProduct } = vi.hoisted(() => ({ createProduct: vi.fn().mockResolvedValue({ ok: true, id: 'p1' }) }))
const push = vi.fn()
vi.mock('@/server/actions/products', () => ({ createProduct, updateProduct: vi.fn(), archiveProduct: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
import { ProductForm } from './ProductForm'

const cats = [{ value: 'c1', label: 'Mesas' }]

describe('ProductForm (create)', () => {
  it('envía nombre, categoría y variantes agregadas', async () => {
    render(<ProductForm mode="create" categories={cats} />)
    await userEvent.type(screen.getByLabelText('Nombre / Modelo'), 'Mesa Roble')
    await userEvent.selectOptions(screen.getByLabelText('Categoría'), 'c1')
    await userEvent.click(screen.getByRole('button', { name: 'Agregar variante' }))
    await userEvent.type(screen.getByLabelText('Medida (fila 1)'), '1,40m')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar producto' }))
    expect(createProduct).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Mesa Roble', categoryId: 'c1',
      variants: [expect.objectContaining({ medida: '1,40m' })],
    }))
    expect(push).toHaveBeenCalledWith('/productos')
  })
  it('muestra el error de la action sin redirigir', async () => {
    createProduct.mockResolvedValueOnce({ ok: false, error: 'Ya existe un producto con ese nombre en la categoría' })
    render(<ProductForm mode="create" categories={cats} />)
    await userEvent.type(screen.getByLabelText('Nombre / Modelo'), 'Mesa Roble')
    await userEvent.selectOptions(screen.getByLabelText('Categoría'), 'c1')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar producto' }))
    expect(await screen.findByText('Ya existe un producto con ese nombre en la categoría')).toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
  })
})
