import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

const { createSale, searchSellableVariantsAction } = vi.hoisted(() => ({
  createSale: vi.fn(),
  searchSellableVariantsAction: vi.fn(),
}))
vi.mock('@/server/actions/sales', () => ({ createSale, searchSellableVariantsAction }))

const { findCustomerByPhoneAction } = vi.hoisted(() => ({ findCustomerByPhoneAction: vi.fn() }))
vi.mock('@/server/actions/customers', () => ({ findCustomerByPhoneAction }))

import { SaleCart } from './SaleCart'

const variant = { variantId: 'v1', productName: 'Sillón Milán', variantName: '2 cuerpos', categoryName: 'Sillones', quantity: 5, unitPrice: 300 }

// El botón de resultado de búsqueda arranca con el nombre del producto
// ("Sillón Milán · 2 cuerpos Quedan 5"); la fila del carrito también repite
// ese texto ("Sillón Milán · 2 cuerpos") pero dentro del botón "Quitar
// Sillón Milán · 2 cuerpos" — nunca al principio del nombre accesible. Por
// eso se busca por rol con un patrón anclado al inicio (`/^Sillón Milán/`)
// en vez de `getByText`, que rompe con "Found multiple elements" apenas hay
// una fila en el carrito Y un resultado de búsqueda visibles a la vez.
const findResultButton = () => screen.findByRole('button', { name: /^Sillón Milán/ })

describe('SaleCart', () => {
  it('busca, agrega al carrito y muestra el total', async () => {
    searchSellableVariantsAction.mockResolvedValue([variant])
    render(<SaleCart />)
    await userEvent.type(screen.getByLabelText('Buscar producto'), 'milán')
    await userEvent.click(await findResultButton())
    // Ancla al string completo: la fila del carrito también contiene "$ 300,00"
    // (como "$ 300,00 c/u · quedan 5"), así que un regex sin anclar matchearía
    // las dos y `getByText` tiraría "Found multiple elements". money() separa
    // "$" del número con un espacio no separable — de ahí el `\s*`.
    expect(screen.getByText(/^\$\s*300,00$/)).toBeInTheDocument() // total con 1 unidad
  })

  it('agregar el mismo ítem dos veces suma cantidad en vez de duplicar la fila', async () => {
    searchSellableVariantsAction.mockResolvedValue([variant])
    render(<SaleCart />)
    await userEvent.type(screen.getByLabelText('Buscar producto'), 'milán')
    await userEvent.click(await findResultButton())
    await userEvent.type(screen.getByLabelText('Buscar producto'), 'milán')
    await userEvent.click(await findResultButton())
    expect(screen.getAllByLabelText(/^Cantidad \(/)).toHaveLength(1)
    expect(screen.getByLabelText(/^Cantidad \(/)).toHaveValue('2')
  })

  it('confirmar llama createSale con el carrito y el método de pago, y redirige', async () => {
    searchSellableVariantsAction.mockResolvedValue([variant])
    createSale.mockResolvedValue({ ok: true, saleId: 's1', number: 7 })
    render(<SaleCart />)
    await userEvent.type(screen.getByLabelText('Buscar producto'), 'milán')
    await userEvent.click(await findResultButton())
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar venta' }))
    expect(createSale).toHaveBeenCalledWith({ items: [{ variantId: 'v1', quantity: 1 }], paymentMethod: 'EFECTIVO' })
    expect(push).toHaveBeenCalledWith('/ventas/s1?justCreated=1')
  })

  it('si createSale falla, muestra el error y no vacía el carrito', async () => {
    searchSellableVariantsAction.mockResolvedValue([variant])
    createSale.mockResolvedValue({ ok: false, error: 'No hay stock suficiente de Sillón Milán · 2 cuerpos (quedan 0)' })
    render(<SaleCart />)
    await userEvent.type(screen.getByLabelText('Buscar producto'), 'milán')
    await userEvent.click(await findResultButton())
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar venta' }))
    expect(await screen.findByText(/No hay stock suficiente/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Cantidad \(/)).toBeInTheDocument()
  })

  it('el botón Confirmar venta está deshabilitado con el carrito vacío', () => {
    render(<SaleCart />)
    expect(screen.getByRole('button', { name: 'Confirmar venta' })).toBeDisabled()
  })
})

describe('SaleCart — cliente', () => {
  it('teléfono que matchea un cliente existente autocompleta el nombre, de solo lectura', async () => {
    searchSellableVariantsAction.mockResolvedValue([variant])
    findCustomerByPhoneAction.mockResolvedValue({ id: 'c1', name: 'Ana Gómez', phone: '1123456789' })
    createSale.mockResolvedValue({ ok: true, saleId: 's1', number: 7 })
    render(<SaleCart />)
    await userEvent.type(screen.getByLabelText('Buscar producto'), 'milán')
    await userEvent.click(await findResultButton())
    await userEvent.type(screen.getByLabelText('Teléfono del cliente (opcional)'), '1123456789')
    expect(await screen.findByText(/Ana Gómez/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Nombre del cliente')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar venta' }))
    expect(createSale).toHaveBeenCalledWith({
      items: [{ variantId: 'v1', quantity: 1 }], paymentMethod: 'EFECTIVO',
      customerPhone: '1123456789', customerName: '',
    })
  })

  it('teléfono nuevo habilita el campo de nombre y lo manda al confirmar', async () => {
    searchSellableVariantsAction.mockResolvedValue([variant])
    findCustomerByPhoneAction.mockResolvedValue(null)
    createSale.mockResolvedValue({ ok: true, saleId: 's1', number: 7 })
    render(<SaleCart />)
    await userEvent.type(screen.getByLabelText('Buscar producto'), 'milán')
    await userEvent.click(await findResultButton())
    await userEvent.type(screen.getByLabelText('Teléfono del cliente (opcional)'), '1123456789')
    const nameInput = await screen.findByLabelText('Nombre del cliente')
    await userEvent.type(nameInput, 'Bruno Díaz')
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar venta' }))
    expect(createSale).toHaveBeenCalledWith({
      items: [{ variantId: 'v1', quantity: 1 }], paymentMethod: 'EFECTIVO',
      customerPhone: '1123456789', customerName: 'Bruno Díaz',
    })
  })

  it('sin teléfono, confirmar no manda customerPhone ni customerName', async () => {
    searchSellableVariantsAction.mockResolvedValue([variant])
    createSale.mockResolvedValue({ ok: true, saleId: 's1', number: 7 })
    render(<SaleCart />)
    await userEvent.type(screen.getByLabelText('Buscar producto'), 'milán')
    await userEvent.click(await findResultButton())
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar venta' }))
    expect(createSale).toHaveBeenCalledWith({ items: [{ variantId: 'v1', quantity: 1 }], paymentMethod: 'EFECTIVO' })
  })
})
