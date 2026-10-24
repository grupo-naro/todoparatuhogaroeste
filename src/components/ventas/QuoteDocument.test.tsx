import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QuoteDocument } from './QuoteDocument'

const quote = {
  lines: [{ productName: 'Sillón Milán', variantName: '2 cuerpos', unitPrice: 300, quantity: 2 }],
  total: 600,
  customerName: null as string | null,
  issuedAt: '2026-10-22T15:00:00.000Z',
}

describe('QuoteDocument', () => {
  it('muestra líneas, total, fecha y la leyenda "Presupuesto sin cargo"', () => {
    render(<QuoteDocument quote={quote} />)
    expect(screen.getByText(/Sillón Milán/)).toBeInTheDocument()
    expect(screen.getByText('Precio de lista:').parentElement).toHaveTextContent(/600,00/)
    expect(screen.getByText(/\d{2}\/\d{2}\/\d{4}/)).toBeInTheDocument()
    expect(screen.getByText(/Presupuesto sin cargo/)).toBeInTheDocument()
  })

  it('muestra el cliente solo si existe', () => {
    const { rerender } = render(<QuoteDocument quote={quote} />)
    expect(screen.getByText('Nombre y apellido:').parentElement).not.toHaveTextContent('Ana')
    rerender(<QuoteDocument quote={{ ...quote, customerName: 'Ana Gómez' }} />)
    expect(screen.getByText('Nombre y apellido:').parentElement).toHaveTextContent('Ana Gómez')
  })

  it('el logo se carga en modo eager para que esté listo al imprimir automáticamente', () => {
    const { container } = render(<QuoteDocument quote={quote} />)
    expect(container.querySelector('img')).toHaveAttribute('loading', 'eager')
  })

  it('muestra la dirección de envío cuando existe', () => {
    const { rerender } = render(<QuoteDocument quote={quote} />)
    expect(screen.getByText('Dirección:').parentElement).not.toHaveTextContent('Siempreviva')
    rerender(<QuoteDocument quote={{ ...quote, shippingAddress: 'Av. Siempreviva 742, Merlo' }} />)
    expect(screen.getByText('Dirección:').parentElement).toHaveTextContent('Av. Siempreviva 742, Merlo')
  })

  it('incluye el pie con Instagram y contactos', () => {
    render(<QuoteDocument quote={quote} />)
    expect(screen.getByText(/@todoparatuhogar_oeste/)).toBeInTheDocument()
    expect(screen.getByText(/Venta Minorista/)).toBeInTheDocument()
  })

  it('tiene la hoja A4 como contenedor de impresión', () => {
    const { container } = render(<QuoteDocument quote={quote} />)
    expect(container.firstElementChild).toHaveClass('a4-sheet')
  })

  it('no muestra vendedora ni método de pago', () => {
    render(<QuoteDocument quote={quote} />)
    expect(screen.queryByText(/Vendedora/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Método de pago/)).not.toBeInTheDocument()
  })
})
