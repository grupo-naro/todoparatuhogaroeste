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
