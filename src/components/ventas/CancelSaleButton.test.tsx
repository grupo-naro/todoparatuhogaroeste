import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

const { cancelSale } = vi.hoisted(() => ({ cancelSale: vi.fn() }))
vi.mock('@/server/actions/sales', () => ({ cancelSale }))

const toast = vi.fn()
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ toast }) }))

import { CancelSaleButton } from './CancelSaleButton'

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

describe('CancelSaleButton', () => {
  it('pide confirmación y llama cancelSale', async () => {
    cancelSale.mockResolvedValue({ ok: true })
    render(<CancelSaleButton saleId="s1" />)
    await userEvent.click(screen.getByRole('button', { name: 'Anular venta' }))
    expect(window.confirm).toHaveBeenCalled()
    expect(cancelSale).toHaveBeenCalledWith('s1')
    expect(toast).toHaveBeenCalledWith('Venta anulada', 'success')
  })

  it('no llama cancelSale si no se confirma', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<CancelSaleButton saleId="s1" />)
    await userEvent.click(screen.getByRole('button', { name: 'Anular venta' }))
    expect(cancelSale).not.toHaveBeenCalled()
  })

  it('muestra el error si cancelSale falla', async () => {
    cancelSale.mockResolvedValue({ ok: false, error: 'Esta venta ya fue anulada' })
    render(<CancelSaleButton saleId="s1" />)
    await userEvent.click(screen.getByRole('button', { name: 'Anular venta' }))
    expect(toast).toHaveBeenCalledWith('Esta venta ya fue anulada', 'danger')
  })
})
