import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const { createUser, resetUserPassword, updateUserRole, setUserActive } = vi.hoisted(() => ({
  createUser: vi.fn().mockResolvedValue({ ok: true }),
  resetUserPassword: vi.fn().mockResolvedValue({ ok: true }),
  updateUserRole: vi.fn().mockResolvedValue({ ok: true }),
  setUserActive: vi.fn().mockResolvedValue({ ok: true }),
}))
vi.mock('@/server/actions/users', () => ({ createUser, resetUserPassword, updateUserRole, setUserActive }))
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
import { UserManager } from './UserManager'

const users = [
  { id: 'u1', name: 'Ana', email: 'ana@a.com', phone: '3794000000', role: 'DEPOSITO' as const, active: true, hasDni: true },
  { id: 'u2', name: 'Legacy', email: 'legacy@a.com', phone: null, role: 'ADMIN' as const, active: false, hasDni: false },
]

describe('UserManager', () => {
  it('muestra la lista de usuarios recibida, con su estado activo/inactivo', () => {
    render(<UserManager users={users} />)
    expect(screen.getByText('Ana')).toBeInTheDocument()
    expect(screen.getByText('ana@a.com')).toBeInTheDocument()
    expect(screen.getByText('Legacy')).toBeInTheDocument()
    expect(screen.getByText('Activo')).toBeInTheDocument()
    expect(screen.getByText('Inactivo')).toBeInTheDocument()
  })

  it('envía el alta con los datos cargados', async () => {
    render(<UserManager users={[]} />)
    await userEvent.type(screen.getByLabelText('Nombre'), 'Nuevo')
    await userEvent.type(screen.getByLabelText('Email'), 'nuevo@a.com')
    await userEvent.type(screen.getByLabelText('Teléfono'), '3794000001')
    await userEvent.selectOptions(screen.getByLabelText('Rol'), 'ADMIN')
    await userEvent.type(screen.getByLabelText('DNI'), '30123456')
    await userEvent.click(screen.getByRole('button', { name: 'Crear usuario' }))
    expect(createUser).toHaveBeenCalled()
    const formData = createUser.mock.calls[0][1] as FormData
    expect(formData.get('name')).toBe('Nuevo')
    expect(formData.get('email')).toBe('nuevo@a.com')
    expect(formData.get('phone')).toBe('3794000001')
    expect(formData.get('role')).toBe('ADMIN')
    expect(formData.get('dni')).toBe('30123456')
  })

  it('el botón de resetear contraseña está deshabilitado si el usuario no tiene DNI', () => {
    render(<UserManager users={users} />)
    expect(screen.getByRole('button', { name: 'Resetear contraseña (Ana)' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Resetear contraseña (Legacy)' })).toBeDisabled()
  })

  it('resetea la contraseña al hacer click', async () => {
    render(<UserManager users={users} />)
    await userEvent.click(screen.getByRole('button', { name: 'Resetear contraseña (Ana)' }))
    expect(resetUserPassword).toHaveBeenCalledWith('u1')
  })

  it('cambia el rol al elegir una opción distinta', async () => {
    render(<UserManager users={users} />)
    await userEvent.selectOptions(screen.getByLabelText('Rol (Ana)'), 'ADMIN')
    expect(updateUserRole).toHaveBeenCalledWith('u1', 'ADMIN')
  })

  it('pide confirmación antes de desactivar, y no desactiva si se cancela', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<UserManager users={users} />)
    await userEvent.click(screen.getByRole('button', { name: 'Desactivar (Ana)' }))
    expect(setUserActive).not.toHaveBeenCalled()
  })

  it('desactiva si se confirma', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<UserManager users={users} />)
    await userEvent.click(screen.getByRole('button', { name: 'Desactivar (Ana)' }))
    expect(setUserActive).toHaveBeenCalledWith('u1', false)
  })

  it('reactiva sin pedir confirmación', async () => {
    render(<UserManager users={users} />)
    await userEvent.click(screen.getByRole('button', { name: 'Reactivar (Legacy)' }))
    expect(setUserActive).toHaveBeenCalledWith('u2', true)
  })
})
