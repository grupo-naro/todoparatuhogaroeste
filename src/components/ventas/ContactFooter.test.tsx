import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ContactFooter } from './ContactFooter'

describe('ContactFooter', () => {
  it('muestra el Instagram del negocio', () => {
    render(<ContactFooter />)
    expect(screen.getByText(/@todoparatuhogar_oeste/)).toBeInTheDocument()
  })

  it('muestra los teléfonos de venta minorista y mayorista', () => {
    render(<ContactFooter />)
    expect(screen.getByText(/Venta Minorista/)).toHaveTextContent('11 2603-9383 • 11 3651-7877')
    expect(screen.getByText(/Venta Mayorista/)).toHaveTextContent('11 2651-1961 • 11 7100-5977')
  })
})
