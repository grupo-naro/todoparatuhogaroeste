import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const { changePassword } = vi.hoisted(() => ({ changePassword: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/server/actions/auth', () => ({ changePassword }))
import { ChangePasswordForm } from './ChangePasswordForm'

describe('ChangePasswordForm', () => {
  it('envía la contraseña nueva y su confirmación', async () => {
    render(<ChangePasswordForm />)
    await userEvent.type(screen.getByLabelText('Contraseña nueva'), 'nueva123')
    await userEvent.type(screen.getByLabelText('Confirmar contraseña'), 'nueva123')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }))
    expect(changePassword).toHaveBeenCalled()
    const formData = changePassword.mock.calls[0][1] as FormData
    expect(formData.get('password')).toBe('nueva123')
    expect(formData.get('confirmPassword')).toBe('nueva123')
  })

  it('muestra el error que devuelve la action', async () => {
    changePassword.mockResolvedValueOnce({ error: 'Las contraseñas no coinciden' })
    render(<ChangePasswordForm />)
    await userEvent.type(screen.getByLabelText('Contraseña nueva'), 'nueva123')
    await userEvent.type(screen.getByLabelText('Confirmar contraseña'), 'otra456')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }))
    expect(await screen.findByText('Las contraseñas no coinciden')).toBeInTheDocument()
  })
})
