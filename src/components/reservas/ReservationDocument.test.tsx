import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReservationDocument } from './ReservationDocument'
import { reservationDetail } from './reservation.fixture'

describe('ReservationDocument', () => {
  it('muestra título, número, clienta y dirección', () => {
    render(<ReservationDocument reservation={reservationDetail()} />)
    expect(screen.getByText('Reserva N° 7')).toBeInTheDocument()
    expect(screen.getByText('Nombre y apellido:').parentElement).toHaveTextContent('Luna Paz')
    expect(screen.getByText('Dirección:').parentElement).toHaveTextContent('Av. Siempreviva 742')
  })

  it('marca cada producto como apartado, parcial o esperando stock', () => {
    render(<ReservationDocument reservation={reservationDetail()} />)
    expect(screen.getByText(/Mesa · Roble/).parentElement).toHaveTextContent('Apartado')
    expect(screen.getByText(/Silla · Terciopelo verde/).parentElement).toHaveTextContent('Apartadas 2 de 6')
  })

  it('un producto sin nada apartado dice "Esperando stock"', () => {
    const r = reservationDetail({ items: [{ variantId: 'v2', productName: 'Silla', variantName: 'Verde', quantity: 2, allocated: 0, unitPrice: 80, currentPrice: 80 }] })
    render(<ReservationDocument reservation={r} />)
    expect(screen.getByText(/Silla · Verde/).parentElement).toHaveTextContent('Esperando stock')
  })

  it('muestra la seña y el saldo', () => {
    render(<ReservationDocument reservation={reservationDetail()} />)
    // total 500 + 6 × 80 = 980; seña 300; saldo 680
    expect(screen.getByText('Seña:').parentElement).toHaveTextContent(/300,00/)
    expect(screen.getByText('Saldo:').parentElement).toHaveTextContent(/680,00/)
  })

  it('sin seña no muestra saldo', () => {
    render(<ReservationDocument reservation={reservationDetail({ payments: [], depositBalance: 0 })} />)
    expect(screen.queryByText('Saldo:')).not.toBeInTheDocument()
  })
})
