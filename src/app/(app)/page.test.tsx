import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const redirect = vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`) })
vi.mock('next/navigation', () => ({ redirect: (url: string) => redirect(url) }))

const requireUser = vi.fn()
vi.mock('@/server/auth/guards', () => ({ requireUser: () => requireUser() }))

const getAdminDashboardStats = vi.fn()
const getVendedorDashboardStats = vi.fn()
vi.mock('@/server/queries/dashboard', () => ({
  getAdminDashboardStats: (...args: unknown[]) => getAdminDashboardStats(...args),
  getVendedorDashboardStats: (...args: unknown[]) => getVendedorDashboardStats(...args),
}))

vi.mock('@/components/dashboard/AdminDashboard', () => ({
  AdminDashboard: ({ period }: { period: string }) => <div>Admin dashboard ({period})</div>,
}))
vi.mock('@/components/dashboard/VendedorDashboard', () => ({
  VendedorDashboard: ({ period }: { period: string }) => <div>Vendedor dashboard ({period})</div>,
}))

import IndexPage from './page'

beforeEach(() => {
  redirect.mockClear()
  requireUser.mockReset()
  getAdminDashboardStats.mockReset()
  getVendedorDashboardStats.mockReset()
})

describe('IndexPage', () => {
  it('ADMIN ve el dashboard de admin', async () => {
    requireUser.mockResolvedValue({ sub: 'u1', role: 'ADMIN', name: 'Ana', mustChangePassword: false })
    getAdminDashboardStats.mockResolvedValue({ totalFacturado: 0, cantidadVentas: 0, clientesNuevos: 0, ventasAnuladas: 0, stockBajo: [] })
    const jsx = await IndexPage({ searchParams: Promise.resolve({}) })
    render(jsx)
    expect(screen.getByText('Admin dashboard (day)')).toBeInTheDocument()
  })

  it('VENDEDOR ve el dashboard de vendedor, con su propio userId y el período de la URL', async () => {
    requireUser.mockResolvedValue({ sub: 'u2', role: 'VENDEDOR', name: 'Bruno', mustChangePassword: false })
    getVendedorDashboardStats.mockResolvedValue({ cantidadPedidos: 0 })
    const jsx = await IndexPage({ searchParams: Promise.resolve({ period: 'week' }) })
    render(jsx)
    expect(screen.getByText('Vendedor dashboard (week)')).toBeInTheDocument()
    expect(getVendedorDashboardStats).toHaveBeenCalledWith('u2', 'week')
  })

  it('DEPOSITO es redirigido a /productos', async () => {
    requireUser.mockResolvedValue({ sub: 'u3', role: 'DEPOSITO', name: 'Carla', mustChangePassword: false })
    await expect(IndexPage({ searchParams: Promise.resolve({}) })).rejects.toThrow('REDIRECT:/productos')
  })

  it('un valor de period inválido en la URL cae al default "day"', async () => {
    requireUser.mockResolvedValue({ sub: 'u1', role: 'ADMIN', name: 'Ana', mustChangePassword: false })
    getAdminDashboardStats.mockResolvedValue({ totalFacturado: 0, cantidadVentas: 0, clientesNuevos: 0, ventasAnuladas: 0, stockBajo: [] })
    const jsx = await IndexPage({ searchParams: Promise.resolve({ period: 'bogus' }) })
    render(jsx)
    expect(screen.getByText('Admin dashboard (day)')).toBeInTheDocument()
  })
})
