import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToastProvider } from '@/components/ui/toast'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
const { updateStoreSettings } = vi.hoisted(() => ({ updateStoreSettings: vi.fn() }))
vi.mock('@/server/actions/settings', () => ({ updateStoreSettings }))

import { ReservationSettingsForm } from './ReservationSettingsForm'

const renderForm = (settings = { reservationExpiryEnabled: true, reservationExpiryDays: 7 }) =>
  render(<ToastProvider><ReservationSettingsForm settings={settings} /></ToastProvider>)

beforeEach(() => { vi.clearAllMocks() })

describe('ReservationSettingsForm', () => {
  it('muestra el interruptor y los días actuales', () => {
    renderForm()
    expect(screen.getByRole('switch', { name: /Liberar reservas automáticamente/ })).toBeChecked()
    expect(screen.getByLabelText('Días')).toHaveValue('7')
  })

  it('aclara que los días cuentan desde que la reserva quedó lista', () => {
    renderForm()
    expect(screen.getByText(/desde que la reserva quedó lista/)).toBeInTheDocument()
  })

  it('con el interruptor apagado el campo de días se deshabilita', async () => {
    renderForm()
    await userEvent.click(screen.getByRole('switch', { name: /Liberar reservas automáticamente/ }))
    expect(screen.getByLabelText('Días')).toBeDisabled()
  })

  it('guardar llama a updateStoreSettings con el interruptor y los días', async () => {
    updateStoreSettings.mockResolvedValue({ ok: true })
    renderForm({ reservationExpiryEnabled: false, reservationExpiryDays: 7 })
    await userEvent.click(screen.getByRole('switch', { name: /Liberar reservas automáticamente/ }))
    const days = screen.getByLabelText('Días')
    await userEvent.clear(days)
    await userEvent.type(days, '15')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(updateStoreSettings).toHaveBeenCalledWith({ reservationExpiryEnabled: true, reservationExpiryDays: 15 })
  })

  it('muestra el error si no se pudo guardar', async () => {
    updateStoreSettings.mockResolvedValue({ ok: false, error: 'Mínimo 1 día' })
    renderForm()
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText('Mínimo 1 día')).toBeInTheDocument()
  })
})
