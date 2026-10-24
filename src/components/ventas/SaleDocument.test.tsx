import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SaleDocument } from './SaleDocument'

const sale = {
  id: 's1', number: 12, createdAt: '2026-10-22T15:00:00.000Z', userName: 'Ana',
  paymentMethod: 'EFECTIVO' as const, total: 600, cancelledAt: null, cancelledByName: null, shippingAddress: null as string | null,
  items: [{ variantId: 'v1', productName: 'Sillón Milán', variantName: '2 cuerpos', quantity: 2, unitPrice: 300, subtotal: 600 }],
}

describe('SaleDocument', () => {
  it('muestra ticket, vendedora, líneas, total y método de pago', () => {
    render(<SaleDocument sale={sale} />)
    expect(screen.getByText(/Ticket N° 12/)).toBeInTheDocument()
    expect(screen.getByText('Vendedora:').parentElement).toHaveTextContent('Ana')
    expect(screen.getByText(/Sillón Milán · 2 cuerpos/)).toHaveTextContent(/2 × .*300,00 c.u/)
    expect(screen.getByText('Total:').parentElement).toHaveTextContent(/600,00/)
    expect(screen.getByText(/Método de pago:/)).toBeInTheDocument()
  })

  it('acepta fechas como string ISO (viene serializada por la API)', () => {
    render(<SaleDocument sale={sale} />)
    expect(screen.getByText(/\d{2}\/\d{2}\/\d{4}/)).toBeInTheDocument()
  })

  it('muestra "Venta anulada" cuando tiene cancelledAt', () => {
    render(<SaleDocument sale={{ ...sale, cancelledAt: '2026-10-22T16:00:00.000Z', cancelledByName: 'Jael' }} />)
    expect(screen.getByText(/Venta anulada el/)).toHaveTextContent(/por Jael/)
  })

  it('el logo se carga en modo eager para que esté listo al imprimir automáticamente', () => {
    const { container } = render(<SaleDocument sale={sale} />)
    expect(container.querySelector('img')).toHaveAttribute('loading', 'eager')
  })

  it('muestra la dirección de envío cuando existe', () => {
    const { rerender } = render(<SaleDocument sale={sale} />)
    expect(screen.getByText('Dirección:').parentElement).not.toHaveTextContent('Siempreviva')
    rerender(<SaleDocument sale={{ ...sale, shippingAddress: 'Av. Siempreviva 742, Merlo' }} />)
    expect(screen.getByText('Dirección:').parentElement).toHaveTextContent('Av. Siempreviva 742, Merlo')
  })

  it('incluye el pie con Instagram y contactos', () => {
    render(<SaleDocument sale={sale} />)
    expect(screen.getByText(/@todoparatuhogar_oeste/)).toBeInTheDocument()
    expect(screen.getByText(/Venta Mayorista/)).toBeInTheDocument()
  })

  it('tiene la hoja A4 como contenedor de impresión', () => {
    const { container } = render(<SaleDocument sale={sale} />)
    expect(container.firstElementChild).toHaveClass('a4-sheet')
  })

  it('no muestra la leyenda de anulada en una venta normal', () => {
    render(<SaleDocument sale={sale} />)
    expect(screen.queryByText(/Venta anulada/)).not.toBeInTheDocument()
  })
})
