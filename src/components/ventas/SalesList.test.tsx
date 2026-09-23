import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { SaleRow } from '@/server/queries/sales'
import { SalesList } from './SalesList'

const sales: SaleRow[] = [
  { id: 's1', number: 7, createdAt: new Date('2026-09-22T18:30:00Z'), userName: 'Ana', paymentMethod: 'EFECTIVO', total: 300, cancelledAt: null },
  { id: 's2', number: 6, createdAt: new Date('2026-09-21T10:00:00Z'), userName: 'Bea', paymentMethod: 'TARJETA', total: 150, cancelledAt: new Date('2026-09-21T11:00:00Z') },
]

describe('SalesList', () => {
  it('renderiza tabla y tarjetas (visibilidad por CSS) con el estado de cada venta', () => {
    render(<SalesList sales={sales} />)
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getAllByText('Ana').length).toBeGreaterThanOrEqual(2) // tabla + tarjeta
    expect(screen.getAllByText('Anulada').length).toBeGreaterThanOrEqual(2)
  })
  it('muestra un mensaje con la lista vacía', () => {
    render(<SalesList sales={[]} />)
    expect(screen.getAllByText('Sin ventas todavía').length).toBeGreaterThanOrEqual(1)
  })
})
