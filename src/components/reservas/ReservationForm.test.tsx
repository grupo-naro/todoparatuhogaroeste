import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

const { createReservation } = vi.hoisted(() => ({ createReservation: vi.fn() }))
vi.mock('@/server/actions/reservations', () => ({ createReservation }))
const { searchSellableVariantsAction } = vi.hoisted(() => ({ searchSellableVariantsAction: vi.fn() }))
vi.mock('@/server/actions/sales', () => ({ searchSellableVariantsAction }))
const { findCustomerByPhoneAction } = vi.hoisted(() => ({ findCustomerByPhoneAction: vi.fn() }))
vi.mock('@/server/actions/customers', () => ({ findCustomerByPhoneAction }))

import { ReservationForm } from './ReservationForm'

const sinStock = { variantId: 'v1', productName: 'Silla', variantName: 'Terciopelo verde', categoryName: 'Sillas', quantity: 0, unitPrice: 80 }
const findResult = () => screen.findByRole('button', { name: /^Silla/ })

async function agregar() {
  searchSellableVariantsAction.mockResolvedValue([sinStock])
  await userEvent.type(screen.getByLabelText('Buscar producto'), 'silla')
  await userEvent.click(await findResult())
}

beforeEach(() => { vi.clearAllMocks(); findCustomerByPhoneAction.mockResolvedValue(null) })

describe('ReservationForm', () => {
  it('permite agregar una variante sin stock y avisa que va a quedar esperando', async () => {
    render(<ReservationForm />)
    await agregar()
    expect(screen.getByText(/queda esperando/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Cantidad \(/)).toHaveValue('1')
  })

  it('sin seña guarda la reserva y redirige al detalle', async () => {
    createReservation.mockResolvedValue({ ok: true, reservationId: 'r9', number: 3 })
    render(<ReservationForm />)
    await agregar()
    await userEvent.click(screen.getByRole('button', { name: 'Guardar reserva' }))
    expect(createReservation).toHaveBeenCalledWith({ items: [{ variantId: 'v1', quantity: 1 }] })
    expect(push).toHaveBeenCalledWith('/reservas/r9')
  })

  it('con seña manda el monto y el método de pago', async () => {
    createReservation.mockResolvedValue({ ok: true, reservationId: 'r9', number: 3 })
    render(<ReservationForm />)
    await agregar()
    await userEvent.type(screen.getByLabelText('Seña (opcional)'), '200')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar reserva' }))
    expect(createReservation).toHaveBeenCalledWith({
      items: [{ variantId: 'v1', quantity: 1 }], deposit: { amount: 200, paymentMethod: 'EFECTIVO' },
    })
  })

  it('manda la clienta, la dirección y la nota', async () => {
    createReservation.mockResolvedValue({ ok: true, reservationId: 'r9', number: 3 })
    render(<ReservationForm />)
    await agregar()
    await userEvent.type(screen.getByLabelText('Teléfono de la clienta'), '1123456789')
    await screen.findByLabelText('Nombre de la clienta')
    await userEvent.type(screen.getByLabelText('Nombre de la clienta'), 'Luna')
    await userEvent.type(screen.getByLabelText('Dirección de envío (opcional)'), 'Calle 1')
    await userEvent.type(screen.getByLabelText('Nota (opcional)'), 'terciopelo')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar reserva' }))
    expect(createReservation).toHaveBeenCalledWith({
      items: [{ variantId: 'v1', quantity: 1 }], customerPhone: '1123456789', customerName: 'Luna',
      shippingAddress: 'Calle 1', note: 'terciopelo',
    })
  })

  it('muestra el error del servidor y no redirige', async () => {
    createReservation.mockResolvedValue({ ok: false, error: 'Silla · Verde no tiene precio cargado' })
    render(<ReservationForm />)
    await agregar()
    await userEvent.click(screen.getByRole('button', { name: 'Guardar reserva' }))
    expect(await screen.findByText('Silla · Verde no tiene precio cargado')).toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
  })

  it('no permite guardar con el carrito vacío', () => {
    render(<ReservationForm />)
    expect(screen.getByRole('button', { name: 'Guardar reserva' })).toBeDisabled()
  })
})

describe('ReservationForm — descuento', () => {
  it('manda el descuento y el motivo', async () => {
    createReservation.mockResolvedValue({ ok: true, reservationId: 'r9', number: 3 })
    render(<ReservationForm />)
    await agregar()
    await userEvent.type(screen.getByLabelText('Descuento ($) (opcional)'), '30')
    await userEvent.type(screen.getByLabelText('Motivo del descuento (opcional)'), 'sin caja')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar reserva' }))
    expect(createReservation).toHaveBeenCalledWith(expect.objectContaining({ discount: 30, discountReason: 'sin caja' }))
  })

  it('resta el descuento del total y bloquea si lo supera', async () => {
    render(<ReservationForm />)
    await agregar()
    await userEvent.type(screen.getByLabelText('Descuento ($) (opcional)'), '30')
    expect(screen.getByText(/^\$\s*50,00$/)).toBeInTheDocument()
    await userEvent.clear(screen.getByLabelText('Descuento ($) (opcional)'))
    await userEvent.type(screen.getByLabelText('Descuento ($) (opcional)'), '500')
    expect(screen.getByText(/no puede superar el total/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar reserva' })).toBeDisabled()
  })
})
