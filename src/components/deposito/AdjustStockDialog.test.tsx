import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const { adjustStock } = vi.hoisted(() => ({ adjustStock: vi.fn() }))
vi.mock('@/server/actions/inventory', () => ({ adjustStock }))
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
import { AdjustStockDialog } from './AdjustStockDialog'

describe('AdjustStockDialog', () => {
  it('abre en modo "Sumar/restar" con "Entrada (+)" por defecto y cantidad vacía', async () => {
    render(<AdjustStockDialog variantId="v1" label="P · V" currentQuantity={5} />)
    await userEvent.click(screen.getByRole('button', { name: 'Ajustar' }))
    expect(screen.getByRole('button', { name: 'Sumar/restar' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Entrada (+)' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Cantidad (ajuste)')).toHaveValue('')
  })

  it('modo delta con Entrada: llama adjustStock con delta positivo', async () => {
    adjustStock.mockResolvedValue({ ok: true, delta: 2, quantityAfter: 7 })
    render(<AdjustStockDialog variantId="v1" label="P · V" currentQuantity={5} />)
    await userEvent.click(screen.getByRole('button', { name: 'Ajustar' }))
    await userEvent.click(screen.getByRole('button', { name: 'Sumar uno (ajuste)' }))
    await userEvent.click(screen.getByRole('button', { name: 'Sumar uno (ajuste)' }))
    await userEvent.type(screen.getByLabelText('Motivo'), 'Llegó mercadería')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar ajuste' }))
    expect(adjustStock).toHaveBeenCalledWith({ variantId: 'v1', mode: 'delta', delta: 2, note: 'Llegó mercadería' })
  })

  it('modo delta con Salida: llama adjustStock con delta negativo', async () => {
    adjustStock.mockResolvedValue({ ok: true, delta: -1, quantityAfter: 4 })
    render(<AdjustStockDialog variantId="v1" label="P · V" currentQuantity={5} />)
    await userEvent.click(screen.getByRole('button', { name: 'Ajustar' }))
    await userEvent.click(screen.getByRole('button', { name: 'Salida (-)' }))
    await userEvent.click(screen.getByRole('button', { name: 'Sumar uno (ajuste)' }))
    await userEvent.type(screen.getByLabelText('Motivo'), 'Rotura')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar ajuste' }))
    expect(adjustStock).toHaveBeenCalledWith({ variantId: 'v1', mode: 'delta', delta: -1, note: 'Rotura' })
  })

  it('modo "Corregir total": precarga la cantidad actual y llama adjustStock en modo set', async () => {
    adjustStock.mockResolvedValue({ ok: true, delta: -2, quantityAfter: 3 })
    render(<AdjustStockDialog variantId="v1" label="P · V" currentQuantity={5} />)
    await userEvent.click(screen.getByRole('button', { name: 'Ajustar' }))
    await userEvent.click(screen.getByRole('button', { name: 'Corregir total' }))
    expect(screen.getByLabelText('Nueva cantidad')).toHaveValue('5')
    await userEvent.clear(screen.getByLabelText('Nueva cantidad'))
    await userEvent.type(screen.getByLabelText('Nueva cantidad'), '3')
    await userEvent.type(screen.getByLabelText('Motivo'), 'Recuento')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar ajuste' }))
    expect(adjustStock).toHaveBeenCalledWith({ variantId: 'v1', mode: 'set', quantity: 3, note: 'Recuento' })
  })

  it('exige motivo: muestra el error de la action', async () => {
    adjustStock.mockResolvedValue({ ok: false, error: 'El motivo es obligatorio' })
    render(<AdjustStockDialog variantId="v1" label="P · V" currentQuantity={5} />)
    await userEvent.click(screen.getByRole('button', { name: 'Ajustar' }))
    await userEvent.click(screen.getByRole('button', { name: 'Sumar uno (ajuste)' }))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar ajuste' }))
    expect(await screen.findByText('El motivo es obligatorio')).toBeInTheDocument()
  })
})
