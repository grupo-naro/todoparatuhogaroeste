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
const { createProduct, createVariant } = vi.hoisted(() => ({
  createProduct: vi.fn().mockResolvedValue({ ok: true, id: 'p1' }),
  createVariant: vi.fn().mockResolvedValue({ ok: true, id: 'v1' }),
}))
const push = vi.fn()
vi.mock('@/server/actions/products', () => ({ createProduct, updateProduct: vi.fn(), archiveProduct: vi.fn() }))
vi.mock('@/server/actions/variants', () => ({ createVariant, updateVariant: vi.fn(), archiveVariant: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
import { ProductForm, type ProductDetail } from './ProductForm'

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
  it('nueva fila de variante toma el costo/precio ya cargados en el producto', async () => {
    render(<ProductForm mode="create" categories={cats} />)
    await userEvent.type(screen.getByLabelText('Costo'), '100')
    await userEvent.type(screen.getByLabelText('Precio'), '150')
    await userEvent.click(screen.getByRole('button', { name: 'Agregar variante' }))
    expect(screen.getByLabelText('Costo (fila 1)')).toHaveValue('100')
    expect(screen.getByLabelText('Precio (fila 1)')).toHaveValue('150')
  })

  it('envía el stock inicial cargado en cada variante al crear el producto', async () => {
    render(<ProductForm mode="create" categories={cats} />)
    await userEvent.type(screen.getByLabelText('Nombre / Modelo'), 'Mesa Roble')
    await userEvent.selectOptions(screen.getByLabelText('Categoría'), 'c1')
    await userEvent.click(screen.getByRole('button', { name: 'Agregar variante' }))
    await userEvent.type(screen.getByLabelText('Stock inicial (fila 1)'), '5')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar producto' }))
    expect(createProduct).toHaveBeenCalledWith(expect.objectContaining({
      variants: [expect.objectContaining({ stockInicial: '5' })],
    }))
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

describe('ProductForm (edit)', () => {
  const product: ProductDetail = {
    id: 'p1', name: 'Respaldo', categoryId: 'c1', description: null,
    defaultCost: null, defaultPrice: null,
    variants: [
      {
        id: 'v1', name: 'Rojo', medida: '1,40m', tela: 'Pana', color: 'Rojo',
        cost: '100', price: '200', sku: 'SKU-ROJO', isDefault: true, stock: null,
      },
    ],
  }

  it('"Agregar variante" toma medida/tela/color/costo/precio de la última variante existente, sin el SKU', () => {
    render(<ProductForm mode="edit" product={product} categories={cats} />)
    expect(screen.getByLabelText('Medida (nueva variante)')).toHaveValue('1,40m')
    expect(screen.getByLabelText('Tela (nueva variante)')).toHaveValue('Pana')
    expect(screen.getByLabelText('Color (nueva variante)')).toHaveValue('Rojo')
    expect(screen.getByLabelText('Costo (nueva variante)')).toHaveValue('100')
    expect(screen.getByLabelText('Precio (nueva variante)')).toHaveValue('200')
    expect(screen.getByLabelText('SKU (nueva variante)')).toHaveValue('')
  })

  it('escribir sobre el color precargado reemplaza el valor en vez de agregarlo al final', async () => {
    render(<ProductForm mode="edit" product={product} categories={cats} />)
    // El campo ya viene con "Rojo" copiado de la última variante; el usuario
    // hace click y tipea el color nuevo sin borrar primero.
    await userEvent.type(screen.getByLabelText('Color (nueva variante)'), 'Azul')
    expect(screen.getByLabelText('Color (nueva variante)')).toHaveValue('Azul')
  })

  it('"Agregar variante" arranca sin stock inicial precargado y lo envía al guardar', async () => {
    render(<ProductForm mode="edit" product={product} categories={cats} />)
    expect(screen.getByLabelText('Stock inicial (nueva variante)')).toHaveValue('')
    await userEvent.type(screen.getByLabelText('Stock inicial (nueva variante)'), '3')
    await userEvent.click(screen.getByRole('button', { name: 'Agregar variante' }))
    expect(createVariant).toHaveBeenCalledWith('p1', expect.objectContaining({ stockInicial: '3' }))
  })
})
