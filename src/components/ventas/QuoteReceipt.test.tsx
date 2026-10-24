import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuoteReceipt } from './QuoteReceipt'

// unitPrice 300 × cantidad 2 = subtotal 600, distinto del unitPrice (300) —
// evita que el total ($ 600,00) matchee por accidente la celda de precio
// unitario al buscar por texto exacto anclado.
const lines = [
  { variantId: 'v1', productName: 'Sillón Milán', variantName: '2 cuerpos', unitPrice: 300, quantity: '2' },
]

describe('QuoteReceipt', () => {
  it('muestra las líneas, cantidades y el total', () => {
    vi.spyOn(window, 'print').mockImplementation(() => {})
    render(<QuoteReceipt lines={lines} total={600} onNuevoPresupuesto={vi.fn()} />)
    expect(screen.getByText(/Sillón Milán/)).toBeInTheDocument()
    expect(screen.getByText('Precio de lista:').parentElement).toHaveTextContent(/600,00/)
  })

  it('muestra el nombre del cliente solo si se pasa customerName', () => {
    vi.spyOn(window, 'print').mockImplementation(() => {})
    const { rerender } = render(<QuoteReceipt lines={lines} total={600} onNuevoPresupuesto={vi.fn()} />)
    expect(screen.getByText('Nombre y apellido:').parentElement).not.toHaveTextContent('Ana')
    rerender(<QuoteReceipt lines={lines} total={600} customerName="Ana Gómez" onNuevoPresupuesto={vi.fn()} />)
    expect(screen.getByText('Nombre y apellido:').parentElement).toHaveTextContent('Ana Gómez')
  })

  it('no muestra vendedora ni método de pago', () => {
    vi.spyOn(window, 'print').mockImplementation(() => {})
    render(<QuoteReceipt lines={lines} total={600} onNuevoPresupuesto={vi.fn()} />)
    expect(screen.queryByText(/Vendedora/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Método de pago/)).not.toBeInTheDocument()
  })

  it('muestra la dirección solo si se pasa shippingAddress', () => {
    vi.spyOn(window, 'print').mockImplementation(() => {})
    const { rerender } = render(<QuoteReceipt lines={lines} total={600} onNuevoPresupuesto={vi.fn()} />)
    expect(screen.getByText('Dirección:').parentElement).not.toHaveTextContent('Siempreviva')
    rerender(<QuoteReceipt lines={lines} total={600} shippingAddress="Av. Siempreviva 742" onNuevoPresupuesto={vi.fn()} />)
    expect(screen.getByText('Dirección:').parentElement).toHaveTextContent('Av. Siempreviva 742')
  })

  it('muestra el texto fijo del pie', () => {
    vi.spyOn(window, 'print').mockImplementation(() => {})
    render(<QuoteReceipt lines={lines} total={600} onNuevoPresupuesto={vi.fn()} />)
    expect(screen.getByText(/Presupuesto sin cargo/)).toBeInTheDocument()
  })

  it('no imprime solo al montarse (lo hace la estación del local)', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {})
    render(<QuoteReceipt lines={lines} total={600} onNuevoPresupuesto={vi.fn()} />)
    expect(printSpy).not.toHaveBeenCalled()
  })

  it('el botón "Imprimir" manual llama a window.print()', async () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {})
    render(<QuoteReceipt lines={lines} total={600} onNuevoPresupuesto={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Imprimir' }))
    expect(printSpy).toHaveBeenCalledTimes(1)
  })

  it('el botón "Nuevo presupuesto" llama a onNuevoPresupuesto', async () => {
    vi.spyOn(window, 'print').mockImplementation(() => {})
    const onNuevo = vi.fn()
    render(<QuoteReceipt lines={lines} total={600} onNuevoPresupuesto={onNuevo} />)
    await userEvent.click(screen.getByRole('button', { name: 'Nuevo presupuesto' }))
    expect(onNuevo).toHaveBeenCalled()
  })

  it('muestra la fecha de emisión', () => {
    vi.spyOn(window, 'print').mockImplementation(() => {})
    render(<QuoteReceipt lines={lines} total={600} onNuevoPresupuesto={vi.fn()} />)
    expect(screen.getByText(/\d{2}\/\d{2}\/\d{4}/)).toBeInTheDocument()
  })
})
