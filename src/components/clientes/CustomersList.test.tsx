import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CustomersList } from './CustomersList'

const customers = [
  { id: 'c1', name: 'Ana Gómez', phone: '1123456789', purchaseCount: 3, totalSpent: 4500, isRecurring: true },
  { id: 'c2', name: 'Bruno Díaz', phone: '1198765432', purchaseCount: 1, totalSpent: 100, isRecurring: false },
]

describe('CustomersList', () => {
  it('renderiza tabla y tarjetas (visibilidad por CSS) con la marca de recurrente', () => {
    render(<CustomersList customers={customers} />)
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getAllByText('Ana Gómez').length).toBeGreaterThanOrEqual(2) // tabla + tarjeta
    expect(screen.getAllByText('Recurrente').length).toBeGreaterThanOrEqual(2) // solo Ana, en ambas vistas
  })
  it('muestra un mensaje con la lista vacía', () => {
    render(<CustomersList customers={[]} />)
    expect(screen.getAllByText('Sin clientes todavía').length).toBeGreaterThanOrEqual(1)
  })
})
