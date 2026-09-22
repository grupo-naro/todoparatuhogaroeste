import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
vi.mock('@/server/actions/inventory', () => ({ adjustStock: vi.fn() }))
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/deposito',
  useSearchParams: () => new URLSearchParams(''),
}))
import { StockList } from './StockList'

const rows = [{ variantId: 'v1', productName: 'Sillón Milán', variantName: '2 cuerpos',
  categoryName: 'Sillones', quantity: 5, unitCost: 100, unitPrice: 300 }]

describe('StockList', () => {
  it('renderiza tabla y tarjetas (visibilidad por CSS) y los totales', () => {
    render(<StockList rows={rows} totalVariants={1} totalUnits={5} />)
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getAllByText('2 cuerpos').length).toBeGreaterThanOrEqual(2)  // tabla + tarjeta
    expect(screen.getAllByText(/1 variantes/).length).toBeGreaterThanOrEqual(1)
  })
  it('muestra "Sin resultados" con lista vacía', () => {
    render(<StockList rows={[]} totalVariants={0} totalUnits={0} />)
    expect(screen.getAllByText('Sin resultados').length).toBeGreaterThanOrEqual(1)
  })
})
