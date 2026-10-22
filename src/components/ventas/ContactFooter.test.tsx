import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ContactFooter } from './ContactFooter'

describe('ContactFooter', () => {
  it('muestra el Instagram del negocio', () => {
    render(<ContactFooter />)
    expect(screen.getByText(/@todoparatuhogar_oeste/)).toBeInTheDocument()
  })

  it('muestra los tres contactos con su teléfono y tipo de venta', () => {
    render(<ContactFooter />)
    expect(screen.getByText(/Magalí/)).toHaveTextContent('+54 9 11 2651-1961')
    expect(screen.getByText(/Magalí/)).toHaveTextContent('venta mayorista')
    expect(screen.getByText(/Luz/)).toHaveTextContent('+54 9 11 3651-7877')
    expect(screen.getByText(/Luz/)).toHaveTextContent('venta minorista')
    expect(screen.getByText(/Lourdes/)).toHaveTextContent('+54 9 11 2603-9383')
    expect(screen.getByText(/Lourdes/)).toHaveTextContent('venta minorista')
  })
})
