import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReservationDepositCopy } from './ReservationDepositCopy'
import { reservationDetail } from './reservation.fixture'

describe('ReservationDepositCopy', () => {
  it('muestra RESERVADO, el número, la clienta y todos los productos en una sola hoja', () => {
    const { container } = render(<ReservationDepositCopy reservation={reservationDetail()} />)
    expect(screen.getByText('Reservado')).toBeInTheDocument()
    expect(screen.getByText('Reserva N° 7')).toBeInTheDocument()
    expect(screen.getByText('Luna Paz')).toBeInTheDocument()
    expect(screen.getByText(/Mesa · Roble/)).toBeInTheDocument()
    expect(screen.getByText(/Silla · Terciopelo verde/)).toBeInTheDocument()
    expect(container.querySelectorAll('.a4-sheet')).toHaveLength(1)
  })

  it('indica si cada producto está apartado o esperando', () => {
    render(<ReservationDepositCopy reservation={reservationDetail()} />)
    expect(screen.getByText(/Mesa · Roble/).closest('li')).toHaveTextContent('Apartado')
    expect(screen.getByText(/Silla · Terciopelo verde/).closest('li')).toHaveTextContent('Esperando')
  })

  it('sin nombre de clienta dice "Sin nombre"', () => {
    render(<ReservationDepositCopy reservation={reservationDetail({ customerName: null })} />)
    expect(screen.getByText('Sin nombre')).toBeInTheDocument()
  })

  it('no muestra precios ni teléfonos', () => {
    const { container } = render(<ReservationDepositCopy reservation={reservationDetail()} />)
    expect(container.textContent).not.toMatch(/\$|1123456789/)
  })
})
