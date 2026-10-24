import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(''),
}))
import { AdminDashboard } from './AdminDashboard'
import type { AdminDashboardStats } from '@/server/queries/dashboard'

const baseStats: AdminDashboardStats = {
  totalFacturado: 1500, cantidadVentas: 3, clientesNuevos: 2, ventasAnuladas: 1, stockBajo: [],
  senasCobradas: 0, reservasListas: 0, senasSinResolver: 0,
}

describe('AdminDashboard', () => {
  it('muestra las 4 métricas formateadas', () => {
    render(<AdminDashboard stats={baseStats} period="day" />)
    expect(screen.getByText(/^\$\s*1\.500,00$/)).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('muestra "Todo con stock" si no hay alertas', () => {
    render(<AdminDashboard stats={baseStats} period="day" />)
    expect(screen.getByText('Todo con stock')).toBeInTheDocument()
  })

  it('lista las variantes con stock bajo', () => {
    const stats: AdminDashboardStats = {
      ...baseStats,
      stockBajo: [{ variantId: 'v1', productName: 'Mesa', variantName: 'Chica', quantity: 2 }],
    }
    render(<AdminDashboard stats={stats} period="day" />)
    expect(screen.getByText(/Mesa/)).toBeInTheDocument()
    expect(screen.getByText(/Chica/)).toBeInTheDocument()
    expect(screen.getByText(/Quedan 2/)).toBeInTheDocument()
    expect(screen.queryByText('Todo con stock')).not.toBeInTheDocument()
  })
})

describe('AdminDashboard con reservas', () => {
  it('muestra Señas cobradas como tarjeta aparte, sin mezclarla con el facturado', () => {
    render(<AdminDashboard stats={{ ...baseStats, senasCobradas: 2500 }} period="day" />)
    expect(screen.getByText('Señas cobradas')).toBeInTheDocument()
    expect(screen.getByText(/^\$\s*2\.500,00$/)).toBeInTheDocument()
    expect(screen.getByText('Total facturado')).toBeInTheDocument()
  })

  it('avisa reservas listas y señas sin resolver, con enlace a Reservas', () => {
    render(<AdminDashboard stats={{ ...baseStats, reservasListas: 2, senasSinResolver: 1 }} period="day" />)
    expect(screen.getByRole('link', { name: /2 reservas listas para avisar/ })).toHaveAttribute('href', '/reservas?tab=listas')
    expect(screen.getByRole('link', { name: /1 seña sin resolver/ })).toHaveAttribute('href', '/reservas?tab=cerradas')
  })

  it('sin reservas pendientes no muestra avisos', () => {
    render(<AdminDashboard stats={baseStats} period="day" />)
    expect(screen.queryByRole('link', { name: /listas para avisar/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /sin resolver/ })).not.toBeInTheDocument()
  })
})
