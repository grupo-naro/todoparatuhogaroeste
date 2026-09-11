import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuantityStepper } from './QuantityStepper'

describe('QuantityStepper', () => {
  it('＋ y − mueven el valor de a 1, sin bajar de 0', async () => {
    const onChange = vi.fn()
    const { rerender } = render(<QuantityStepper value="0" onChange={onChange} ariaLabel="Cantidad (ítem 1)" />)
    await userEvent.click(screen.getByRole('button', { name: 'Sumar uno (ítem 1)' }))
    expect(onChange).toHaveBeenLastCalledWith('1')
    onChange.mockClear()
    rerender(<QuantityStepper value="0" onChange={onChange} ariaLabel="Cantidad (ítem 1)" />)
    await userEvent.click(screen.getByRole('button', { name: 'Restar uno (ítem 1)' }))
    expect(onChange).toHaveBeenLastCalledWith('0')
  })
  it('el input refleja el value y propaga cambios', async () => {
    const onChange = vi.fn()
    render(<QuantityStepper value="5" onChange={onChange} ariaLabel="Cantidad (ítem 1)" />)
    const input = screen.getByLabelText('Cantidad (ítem 1)')
    expect(input).toHaveValue('5')
    await userEvent.type(input, '0')
    expect(onChange).toHaveBeenCalledWith('50')
  })
})
