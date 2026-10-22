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
    expect(screen.getByText(/^Total:/)).toHaveTextContent(/600,00/)
    expect(screen.getByText(/\d{2}\/\d{2}\/\d{4}/)).toBeInTheDocument()
    expect(screen.getByText(/Presupuesto sin cargo/)).toBeInTheDocument()
  })

  it('muestra el cliente solo si existe', () => {
    const { rerender } = render(<QuoteDocument quote={quote} />)
    expect(screen.queryByText(/Presupuesto para/)).not.toBeInTheDocument()
    rerender(<QuoteDocument quote={{ ...quote, customerName: 'Ana Gómez' }} />)
    expect(screen.getByText('Ana Gómez')).toBeInTheDocument()
  })

  it('no muestra vendedora ni método de pago', () => {
    render(<QuoteDocument quote={quote} />)
    expect(screen.queryByText(/Vendedora/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Método de pago/)).not.toBeInTheDocument()
  })
})
