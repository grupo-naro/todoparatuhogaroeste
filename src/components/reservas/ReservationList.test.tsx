import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReservationList } from './ReservationList'
import { ReservationTabs } from './ReservationTabs'
import type { ReservationRow } from '@/server/queries/reservations'

const row = (over: Partial<ReservationRow> = {}): ReservationRow => ({
  id: 'r1', number: 7, status: 'ESPERANDO', userName: 'Ana', customerName: 'Luna Paz',
  createdAt: new Date('2026-10-24T15:00:00Z'), readyAt: null, notifiedAt: null,
  items: [{ productName: 'Mesa', variantName: 'Roble', quantity: 1, allocated: 1 }, { productName: 'Silla', variantName: 'Verde', quantity: 6, allocated: 2 }],
  missingUnits: 4, depositBalance: 300, ...over,
})

describe('ReservationTabs', () => {
  it('muestra las tres pestañas y marca la actual', () => {
    render(<ReservationTabs tab="listas" />)
    expect(screen.getByRole('link', { name: 'Esperando' })).toHaveAttribute('href', '/reservas?tab=esperando')
    expect(screen.getByRole('link', { name: 'Listas' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Cerradas' })).toHaveAttribute('href', '/reservas?tab=cerradas')
  })
})

describe('ReservationList', () => {
  it('muestra la clienta, los faltantes y la seña de cada reserva, con enlace al detalle', () => {
    render(<ReservationList rows={[row()]} />)
    expect(screen.getByRole('link', { name: /Luna Paz/ })).toHaveAttribute('href', '/reservas/r1')
    expect(screen.getByText(/Faltan 4/)).toBeInTheDocument()
    expect(screen.getByText(/Seña/)).toHaveTextContent(/300,00/)
  })

  it('una reserva lista que todavía no se avisó lo indica', () => {
    render(<ReservationList rows={[row({ status: 'LISTA', missingUnits: 0 })]} />)
    expect(screen.getByText('Sin avisar')).toBeInTheDocument()
  })

  it('sin reservas muestra un mensaje', () => {
    render(<ReservationList rows={[]} />)
    expect(screen.getByText(/No hay reservas/)).toBeInTheDocument()
  })
})
