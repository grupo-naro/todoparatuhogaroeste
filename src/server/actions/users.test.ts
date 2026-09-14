import { describe, expect, it, beforeEach, vi } from 'vitest'
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/server/auth/guards', () => ({
  requireRole: vi.fn().mockResolvedValue({ sub: 'admin1', role: 'ADMIN', name: 'Admin', mustChangePassword: false }),
}))
import { prisma, resetDb } from '@/test/db'
import { verifyPassword } from '@/server/auth/password'
import { createUser } from './users'
import { listUsers } from '@/server/queries/users'

const fd = (fields: Record<string, string>) => {
  const f = new FormData()
  for (const [k, v] of Object.entries(fields)) f.set(k, v)
  return f
}

beforeEach(async () => {
  await resetDb()
})

describe('createUser', () => {
  it('crea el usuario con la contraseña inicial = DNI y mustChangePassword true', async () => {
    const res = await createUser(undefined, fd({
      name: 'Nahuel', email: 'nahuel@a.com', phone: '3794000000', role: 'DEPOSITO', dni: '30123456',
    }))
    expect(res).toEqual({ ok: true })
    const u = await prisma.user.findUniqueOrThrow({ where: { email: 'nahuel@a.com' } })
    expect(u).toMatchObject({ name: 'Nahuel', phone: '3794000000', role: 'DEPOSITO', dni: '30123456', mustChangePassword: true })
    expect(await verifyPassword('30123456', u.passwordHash)).toBe(true)
  })

  it('rechaza DNI con formato inválido', async () => {
    const res = await createUser(undefined, fd({ name: 'Xx', email: 'x@a.com', phone: '', role: 'DEPOSITO', dni: 'abc' }))
    expect(res).toEqual({ ok: false, error: 'DNI inválido (7 u 8 dígitos)' })
  })

  it('rechaza email duplicado', async () => {
    await createUser(undefined, fd({ name: 'Aa', email: 'dup@a.com', phone: '', role: 'DEPOSITO', dni: '30123456' }))
    const res = await createUser(undefined, fd({ name: 'Bb', email: 'dup@a.com', phone: '', role: 'DEPOSITO', dni: '30123457' }))
    expect(res).toEqual({ ok: false, error: 'Ya existe un usuario con ese email' })
  })

  it('rechaza DNI duplicado', async () => {
    await createUser(undefined, fd({ name: 'Aa', email: 'a1@a.com', phone: '', role: 'DEPOSITO', dni: '30123456' }))
    const res = await createUser(undefined, fd({ name: 'Bb', email: 'a2@a.com', phone: '', role: 'DEPOSITO', dni: '30123456' }))
    expect(res).toEqual({ ok: false, error: 'Ya existe un usuario con ese DNI' })
  })

  it('teléfono vacío se guarda como null', async () => {
    await createUser(undefined, fd({ name: 'Aa', email: 'noph@a.com', phone: '', role: 'ADMIN', dni: '30123456' }))
    const u = await prisma.user.findUniqueOrThrow({ where: { email: 'noph@a.com' } })
    expect(u.phone).toBeNull()
  })
})

describe('listUsers', () => {
  it('no expone el DNI, solo si existe', async () => {
    await createUser(undefined, fd({ name: 'Con DNI', email: 'c@a.com', phone: '', role: 'DEPOSITO', dni: '30123456' }))
    const rows = await listUsers()
    const row = rows.find((r) => r.email === 'c@a.com')
    expect(row).toMatchObject({ name: 'Con DNI', hasDni: true })
    expect(row).not.toHaveProperty('dni')
  })
})
