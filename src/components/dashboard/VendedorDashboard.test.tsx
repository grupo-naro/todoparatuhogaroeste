import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(''),
}))
import { VendedorDashboard } from './VendedorDashboard'

describe('VendedorDashboard', () => {
  it('muestra la cantidad de pedidos', () => {
    render(<VendedorDashboard stats={{ cantidadPedidos: 7 }} period="week" />)
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('Pedidos')).toBeInTheDocument()
  })

  it('no muestra ningún monto en $ — la vendedora no ve facturación', () => {
    render(<VendedorDashboard stats={{ cantidadPedidos: 7 }} period="week" />)
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument()
  })
})
