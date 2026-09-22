import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const { adjustStock } = vi.hoisted(() => ({ adjustStock: vi.fn() }))
vi.mock('@/server/actions/inventory', () => ({ adjustStock }))
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
import { AdjustStockDialog } from './AdjustStockDialog'

describe('AdjustStockDialog', () => {
  it('exige motivo: muestra el error de la action', async () => {
    adjustStock.mockResolvedValue({ ok: false, error: 'El motivo es obligatorio' })
    render(<AdjustStockDialog variantId="v1" label="P · V" currentQuantity={5} />)
    await userEvent.click(screen.getByRole('button', { name: 'Ajustar' }))
    await userEvent.clear(screen.getByLabelText('Nueva cantidad'))
    await userEvent.type(screen.getByLabelText('Nueva cantidad'), '3')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar ajuste' }))
    expect(adjustStock).toHaveBeenCalledWith({ variantId: 'v1', quantity: 3, note: '' })
    expect(await screen.findByText('El motivo es obligatorio')).toBeInTheDocument()
  })
  it('con datos válidos llama adjustStock con el motivo', async () => {
    adjustStock.mockResolvedValue({ ok: true, delta: -2, quantityAfter: 3 })
    render(<AdjustStockDialog variantId="v1" label="P · V" currentQuantity={5} />)
    await userEvent.click(screen.getByRole('button', { name: 'Ajustar' }))
    await userEvent.clear(screen.getByLabelText('Nueva cantidad'))
    await userEvent.type(screen.getByLabelText('Nueva cantidad'), '3')
    await userEvent.type(screen.getByLabelText('Motivo'), 'Rotura')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar ajuste' }))
    expect(adjustStock).toHaveBeenCalledWith({ variantId: 'v1', quantity: 3, note: 'Rotura' })
  })
})
