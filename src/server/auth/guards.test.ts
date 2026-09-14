import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('next/navigation', () => {
  const redirect = vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`) })
  return { redirect }
})

vi.mock('./session', () => {
  const readSession = vi.fn()
  return { readSession }
})

import { requireUser, requireRole } from './guards'
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
})
