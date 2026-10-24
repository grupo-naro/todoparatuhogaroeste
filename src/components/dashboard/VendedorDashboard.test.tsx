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
    render(<VendedorDashboard stats={{ cantidadPedidos: 7, reservasListas: 0 }} period="week" />)
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('Pedidos')).toBeInTheDocument()
  })

  it('no muestra ningún monto en $ — la vendedora no ve facturación', () => {
    render(<VendedorDashboard stats={{ cantidadPedidos: 7, reservasListas: 0 }} period="week" />)
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument()
  })
})

describe('VendedorDashboard con reservas', () => {
  it('avisa las reservas listas de la vendedora, con enlace', () => {
    render(<VendedorDashboard stats={{ cantidadPedidos: 4, reservasListas: 2 }} period="day" />)
    expect(screen.getByRole('link', { name: /2 reservas listas para avisar/ })).toHaveAttribute('href', '/reservas?tab=listas')
  })

  it('sin reservas listas no muestra el aviso', () => {
    render(<VendedorDashboard stats={{ cantidadPedidos: 4, reservasListas: 0 }} period="day" />)
    expect(screen.queryByRole('link', { name: /listas para avisar/ })).not.toBeInTheDocument()
  })
})
