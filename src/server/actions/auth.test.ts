import { describe, expect, it, beforeEach, beforeAll, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))
vi.mock('@/server/auth/session', () => ({
  createSession: vi.fn(),
  destroySession: vi.fn(),
  SESSION_COOKIE: 'session',
}))

import { redirect } from 'next/navigation'
import { createSession } from '@/server/auth/session'
import { prisma, resetDb } from '@/test/db'
import { hashPassword } from '@/server/auth/password'
import { signIn } from './auth'

beforeAll(() => {
  process.env.AUTH_SECRET = 'test-secret-1234567890'
})
beforeEach(async () => {
  await resetDb()
  vi.mocked(redirect).mockClear()
  vi.mocked(createSession).mockClear()
})

const fd = (email: string, password: string) => {
  const f = new FormData()
  f.set('email', email)
  f.set('password', password)
  return f
}

describe('signIn', () => {
  it('con credenciales válidas crea sesión y redirige a /productos', async () => {
    await prisma.user.create({
      data: { email: 'a@a.com', name: 'Ana', role: 'DEPOSITO', passwordHash: await hashPassword('secreto123') },
    })
    await expect(signIn(undefined, fd('a@a.com', 'secreto123'))).rejects.toThrow('REDIRECT:/productos')
    expect(vi.mocked(createSession)).toHaveBeenCalledWith(expect.objectContaining({ role: 'DEPOSITO', name: 'Ana' }))
  })

  it('con contraseña incorrecta devuelve error y no crea sesión', async () => {
    await prisma.user.create({
      data: { email: 'a@a.com', name: 'Ana', role: 'DEPOSITO', passwordHash: await hashPassword('secreto123') },
    })
    expect(await signIn(undefined, fd('a@a.com', 'mala'))).toEqual({ error: 'Email o contraseña incorrectos' })
    expect(vi.mocked(createSession)).not.toHaveBeenCalled()
  })

  it('usuario inactivo no puede ingresar', async () => {
    await prisma.user.create({
      data: {
        email: 'a@a.com',
        name: 'Ana',
        role: 'DEPOSITO',
        active: false,
        passwordHash: await hashPassword('secreto123'),
      },
    })
    expect(await signIn(undefined, fd('a@a.com', 'secreto123'))).toEqual({ error: 'Usuario inactivo' })
  })
})
