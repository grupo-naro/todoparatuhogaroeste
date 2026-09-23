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
vi.mock('@/server/auth/guards', () => ({ requireUserAllowingPasswordChange: vi.fn() }))

import { redirect } from 'next/navigation'
import { createSession } from '@/server/auth/session'
import { prisma, resetDb } from '@/test/db'
import { hashPassword, verifyPassword } from '@/server/auth/password'
import { signIn, changePassword } from './auth'

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
  it('con credenciales válidas crea sesión y redirige a /', async () => {
    await prisma.user.create({
      data: { email: 'a@a.com', name: 'Ana', role: 'DEPOSITO', passwordHash: await hashPassword('secreto123') },
    })
    await expect(signIn(undefined, fd('a@a.com', 'secreto123'))).rejects.toThrow('REDIRECT:/')
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

  it('propaga mustChangePassword del usuario a la sesión', async () => {
    await prisma.user.create({
      data: {
        email: 'nuevo@a.com', name: 'Nuevo', role: 'DEPOSITO', mustChangePassword: true,
        passwordHash: await hashPassword('30123456'),
      },
    })
    await expect(signIn(undefined, fd('nuevo@a.com', '30123456'))).rejects.toThrow('REDIRECT:/')
    expect(vi.mocked(createSession)).toHaveBeenCalledWith(expect.objectContaining({ mustChangePassword: true }))
  })
})

describe('changePassword', () => {
  it('actualiza la contraseña, apaga mustChangePassword y reemite la sesión', async () => {
    const user = await prisma.user.create({
      data: { email: 'p@a.com', name: 'P', passwordHash: 'old-hash', mustChangePassword: true },
    })
    vi.mocked((await import('@/server/auth/guards')).requireUserAllowingPasswordChange).mockResolvedValue({
      sub: user.id, role: 'DEPOSITO', name: 'P', mustChangePassword: true,
    })
    const fdPw = new FormData()
    fdPw.set('password', 'nueva123')
    fdPw.set('confirmPassword', 'nueva123')

    await expect(changePassword(undefined, fdPw)).rejects.toThrow('REDIRECT:/')

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(updated.mustChangePassword).toBe(false)
    expect(await verifyPassword('nueva123', updated.passwordHash)).toBe(true)
    expect(vi.mocked(createSession)).toHaveBeenCalledWith({
      sub: user.id, role: 'DEPOSITO', name: 'P', mustChangePassword: false,
    })
  })

  it('rechaza contraseña de menos de 6 caracteres', async () => {
    vi.mocked((await import('@/server/auth/guards')).requireUserAllowingPasswordChange).mockResolvedValue({
      sub: 'x', role: 'DEPOSITO', name: 'X', mustChangePassword: true,
    })
    const fdPw = new FormData()
    fdPw.set('password', '123')
    fdPw.set('confirmPassword', '123')
    expect(await changePassword(undefined, fdPw)).toEqual({ error: 'La contraseña debe tener al menos 6 caracteres' })
  })

  it('rechaza si las contraseñas no coinciden', async () => {
    vi.mocked((await import('@/server/auth/guards')).requireUserAllowingPasswordChange).mockResolvedValue({
      sub: 'x', role: 'DEPOSITO', name: 'X', mustChangePassword: true,
    })
    const fdPw = new FormData()
    fdPw.set('password', 'nueva123')
    fdPw.set('confirmPassword', 'otra123')
    expect(await changePassword(undefined, fdPw)).toEqual({ error: 'Las contraseñas no coinciden' })
  })

  it('rechaza si la sesión no necesita cambiar la contraseña', async () => {
    vi.mocked((await import('@/server/auth/guards')).requireUserAllowingPasswordChange).mockResolvedValue({
      sub: 'x', role: 'DEPOSITO', name: 'X', mustChangePassword: false,
    })
    const fdPw = new FormData()
    fdPw.set('password', 'nueva123')
    fdPw.set('confirmPassword', 'nueva123')
    await expect(changePassword(undefined, fdPw)).rejects.toThrow('REDIRECT:/')
  })

  it('rechaza que la contraseña nueva sea el propio DNI', async () => {
    const user = await prisma.user.create({
      data: { email: 'dni@a.com', name: 'D', passwordHash: 'old-hash', dni: '30123456', mustChangePassword: true },
    })
    vi.mocked((await import('@/server/auth/guards')).requireUserAllowingPasswordChange).mockResolvedValue({
      sub: user.id, role: 'DEPOSITO', name: 'D', mustChangePassword: true,
    })
    const fdPw = new FormData()
    fdPw.set('password', '30123456')
    fdPw.set('confirmPassword', '30123456')
    expect(await changePassword(undefined, fdPw)).toEqual({ error: 'La contraseña nueva no puede ser tu DNI' })
  })
})
