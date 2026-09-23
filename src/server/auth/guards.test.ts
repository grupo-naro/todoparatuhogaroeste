import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('next/navigation', () => {
  const redirect = vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`) })
  return { redirect }
})

vi.mock('./session', () => {
  const readSession = vi.fn()
  return { readSession }
})

import { requireUser, requireRole, requireUserAllowingPasswordChange } from './guards'
import { redirect } from 'next/navigation'
import { readSession } from './session'

beforeEach(() => {
  vi.mocked(redirect).mockClear()
  vi.mocked(readSession).mockReset()
})

describe('requireUser', () => {
  it('devuelve la sesión si existe', async () => {
    vi.mocked(readSession).mockResolvedValue({ sub: 'u1', role: 'DEPOSITO', name: 'Ana', mustChangePassword: false })
    await expect(requireUser()).resolves.toMatchObject({ sub: 'u1' })
  })
  it('redirige a /login si no hay sesión', async () => {
    vi.mocked(readSession).mockResolvedValue(null)
    await expect(requireUser()).rejects.toThrow('REDIRECT:/login')
  })
  it('redirige a /cambiar-contrasena si la sesión debe cambiar la contraseña', async () => {
    vi.mocked(readSession).mockResolvedValue({ sub: 'u1', role: 'DEPOSITO', name: 'Ana', mustChangePassword: true })
    await expect(requireUser()).rejects.toThrow('REDIRECT:/cambiar-contrasena')
  })
})

describe('requireRole', () => {
  it('redirige a /productos si el rol no coincide', async () => {
    vi.mocked(readSession).mockResolvedValue({ sub: 'u1', role: 'DEPOSITO', name: 'Ana', mustChangePassword: false })
    await expect(requireRole('ADMIN')).rejects.toThrow('REDIRECT:/productos')
  })
  it('devuelve la sesión si el rol coincide', async () => {
    vi.mocked(readSession).mockResolvedValue({ sub: 'u1', role: 'ADMIN', name: 'Ana', mustChangePassword: false })
    await expect(requireRole('ADMIN')).resolves.toMatchObject({ role: 'ADMIN' })
  })
  it('acepta un array de roles y redirige si ninguno coincide', async () => {
    vi.mocked(readSession).mockResolvedValue({ sub: 'u1', role: 'DEPOSITO', name: 'Ana', mustChangePassword: false })
    await expect(requireRole(['ADMIN', 'VENDEDOR'])).rejects.toThrow('REDIRECT:/productos')
  })
  it('acepta un array de roles y devuelve la sesión si alguno coincide', async () => {
    vi.mocked(readSession).mockResolvedValue({ sub: 'u1', role: 'VENDEDOR', name: 'Ana', mustChangePassword: false })
    await expect(requireRole(['ADMIN', 'VENDEDOR'])).resolves.toMatchObject({ role: 'VENDEDOR' })
  })
  it('redirige a /ventas (no /productos) si un VENDEDOR no tiene el rol requerido', async () => {
    vi.mocked(readSession).mockResolvedValue({ sub: 'u1', role: 'VENDEDOR', name: 'Ana', mustChangePassword: false })
    await expect(requireRole('ADMIN')).rejects.toThrow('REDIRECT:/ventas')
  })
})

describe('requireUserAllowingPasswordChange', () => {
  it('devuelve la sesión aunque deba cambiar la contraseña', async () => {
    vi.mocked(readSession).mockResolvedValue({ sub: 'u1', role: 'DEPOSITO', name: 'Ana', mustChangePassword: true })
    await expect(requireUserAllowingPasswordChange()).resolves.toMatchObject({ sub: 'u1' })
  })
  it('redirige a /login si no hay sesión', async () => {
    vi.mocked(readSession).mockResolvedValue(null)
    await expect(requireUserAllowingPasswordChange()).rejects.toThrow('REDIRECT:/login')
  })
})
