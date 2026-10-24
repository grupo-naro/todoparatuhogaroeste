import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToastProvider } from '@/components/ui/toast'

const push = vi.fn()
const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }))

const actions = vi.hoisted(() => ({
  addDeposit: vi.fn(), addRefund: vi.fn(), cancelReservation: vi.fn(), convertReservation: vi.fn(),
  resolveDeposit: vi.fn(), markReservationNotified: vi.fn(), reprintReservation: vi.fn(),
}))
vi.mock('@/server/actions/reservations', () => actions)

import { ReservationActions } from './ReservationActions'
import { reservationDetail } from './reservation.fixture'

const lista = (over = {}) => reservationDetail({
  status: 'LISTA', readyAt: new Date('2026-10-24T16:00:00Z'),
  items: [{ variantId: 'v1', productName: 'Mesa', variantName: 'Roble', quantity: 1, allocated: 1, unitPrice: 500, currentPrice: 500 }],
  ...over,
})
const renderActions = (r = lista()) => render(<ToastProvider><ReservationActions reservation={r} /></ToastProvider>)

beforeEach(() => { vi.clearAllMocks() })

describe('ReservationActions — concretar', () => {
  it('está deshabilitado mientras la reserva está ESPERANDO', () => {
    renderActions(reservationDetail())
    expect(screen.getByRole('button', { name: 'Concretar venta' })).toBeDisabled()
  })

  it('con la reserva lista concreta la venta y redirige al ticket', async () => {
    actions.convertReservation.mockResolvedValue({ ok: true, saleId: 's1', number: 9 })
    renderActions()
    await userEvent.click(screen.getByRole('button', { name: 'Concretar venta' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar venta' }))
    expect(actions.convertReservation).toHaveBeenCalledWith({ id: 'r1', paymentMethod: 'EFECTIVO' })
    expect(push).toHaveBeenCalledWith('/ventas/s1')
  })

  it('si cambiaron los precios muestra los dos y obliga a elegir', async () => {
    actions.convertReservation.mockResolvedValue({ ok: true, saleId: 's1', number: 9 })
    const r = lista({ items: [{ variantId: 'v1', productName: 'Mesa', variantName: 'Roble', quantity: 1, allocated: 1, unitPrice: 400, currentPrice: 500 }] })
    renderActions(r)
    await userEvent.click(screen.getByRole('button', { name: 'Concretar venta' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/400,00/)).toBeInTheDocument()
    expect(within(dialog).getByText(/500,00/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar venta' })).toBeDisabled()
    await userEvent.click(screen.getByRole('radio', { name: /precio actual/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar venta' }))
    expect(actions.convertReservation).toHaveBeenCalledWith({ id: 'r1', paymentMethod: 'EFECTIVO', priceMode: 'ACTUAL' })
  })

  it('muestra el error si la venta no se puede concretar', async () => {
    actions.convertReservation.mockResolvedValue({ ok: false, error: 'La seña supera el total' })
    renderActions()
    await userEvent.click(screen.getByRole('button', { name: 'Concretar venta' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar venta' }))
    expect(await screen.findByText('La seña supera el total')).toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
  })
})

describe('ReservationActions — avisar', () => {
  it('abre WhatsApp con el teléfono de la clienta y la marca como avisada', async () => {
    actions.markReservationNotified.mockResolvedValue({ ok: true })
    renderActions()
    const link = screen.getByRole('link', { name: /Avisar por WhatsApp/ })
    expect(link).toHaveAttribute('href', expect.stringContaining('https://wa.me/5491123456789?text='))
    expect(link).toHaveAttribute('target', '_blank')
    await userEvent.click(link)
    expect(actions.markReservationNotified).toHaveBeenCalledWith('r1')
  })

  it('no ofrece avisar si la reserva no está lista o no hay teléfono', () => {
    const { unmount } = renderActions(reservationDetail())
    expect(screen.queryByRole('link', { name: /Avisar por WhatsApp/ })).not.toBeInTheDocument()
    unmount()
    renderActions(lista({ customerPhone: null }))
    expect(screen.queryByRole('link', { name: /Avisar por WhatsApp/ })).not.toBeInTheDocument()
  })
})

describe('ReservationActions — cancelar y señas', () => {
  it('cancelar con seña obliga a elegir devolver o retener', async () => {
    actions.cancelReservation.mockResolvedValue({ ok: true })
    renderActions()
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar reserva' }))
    const confirm = screen.getByRole('button', { name: 'Sí, cancelar reserva' })
    expect(confirm).toBeDisabled()
    await userEvent.click(screen.getByRole('radio', { name: /Devolver la seña/ }))
    await userEvent.click(confirm)
    expect(actions.cancelReservation).toHaveBeenCalledWith({ id: 'r1', deposit: { action: 'DEVOLVER', paymentMethod: 'EFECTIVO' } })
  })

  it('retener la seña manda RETENER', async () => {
    actions.cancelReservation.mockResolvedValue({ ok: true })
    renderActions()
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar reserva' }))
    await userEvent.click(screen.getByRole('radio', { name: /Quedarme con la seña/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Sí, cancelar reserva' }))
    expect(actions.cancelReservation).toHaveBeenCalledWith({ id: 'r1', deposit: { action: 'RETENER' } })
  })

  it('cancelar sin seña no pide decisión', async () => {
    actions.cancelReservation.mockResolvedValue({ ok: true })
    renderActions(lista({ payments: [], depositBalance: 0 }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar reserva' }))
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Sí, cancelar reserva' }))
    expect(actions.cancelReservation).toHaveBeenCalledWith({ id: 'r1' })
  })

  it('registra una seña nueva', async () => {
    actions.addDeposit.mockResolvedValue({ ok: true })
    renderActions()
    await userEvent.click(screen.getByRole('button', { name: 'Registrar seña' }))
    await userEvent.type(screen.getByLabelText('Monto de la seña'), '150')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar seña' }))
    expect(actions.addDeposit).toHaveBeenCalledWith({ reservationId: 'r1', amount: 150, paymentMethod: 'EFECTIVO' })
  })

  it('devuelve una parte de la seña en una reserva abierta', async () => {
    actions.addRefund.mockResolvedValue({ ok: true })
    renderActions()
    await userEvent.click(screen.getByRole('button', { name: 'Devolver parte de la seña' }))
    await userEvent.type(screen.getByLabelText('Monto'), '100')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar devolución' }))
    expect(actions.addRefund).toHaveBeenCalledWith({ reservationId: 'r1', amount: 100, paymentMethod: 'EFECTIVO' })
  })

  it('no ofrece devolver parte de la seña si no hay seña', () => {
    renderActions(lista({ payments: [], depositBalance: 0 }))
    expect(screen.queryByRole('button', { name: 'Devolver parte de la seña' })).not.toBeInTheDocument()
  })

  it('una reserva vencida con seña sin resolver ofrece resolverla', async () => {
    actions.resolveDeposit.mockResolvedValue({ ok: true })
    renderActions(reservationDetail({ status: 'VENCIDA', depositResolution: null }))
    expect(screen.queryByRole('button', { name: 'Concretar venta' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Resolver seña' }))
    await userEvent.click(screen.getByRole('radio', { name: /Quedarme con la seña/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(actions.resolveDeposit).toHaveBeenCalledWith({ id: 'r1', deposit: { action: 'RETENER' } })
  })

  it('reimprimir encola la impresión', async () => {
    actions.reprintReservation.mockResolvedValue({ ok: true })
    renderActions()
    await userEvent.click(screen.getByRole('button', { name: 'Reimprimir' }))
    expect(actions.reprintReservation).toHaveBeenCalledWith('r1')
  })
})
