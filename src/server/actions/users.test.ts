import { describe, expect, it, beforeEach, vi } from 'vitest'
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/server/auth/guards', () => ({
  requireRole: vi.fn().mockResolvedValue({ sub: 'admin1', role: 'ADMIN', name: 'Admin', mustChangePassword: false }),
}))
import { prisma, resetDb } from '@/test/db'
import { verifyPassword } from '@/server/auth/password'
import { createUser, resetUserPassword, updateUserRole, setUserActive } from './users'
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

describe('resetUserPassword', () => {
  it('vuelve la contraseña al DNI y reactiva mustChangePassword', async () => {
    await createUser(undefined, fd({ name: 'Aa', email: 'reset@a.com', phone: '', role: 'DEPOSITO', dni: '30123456' }))
    let u = await prisma.user.findUniqueOrThrow({ where: { email: 'reset@a.com' } })
    // Simulate the user having already changed their password once.
    await prisma.user.update({ where: { id: u.id }, data: { passwordHash: 'otro-hash', mustChangePassword: false } })

    const res = await resetUserPassword(u.id)
    expect(res).toEqual({ ok: true })
    u = await prisma.user.findUniqueOrThrow({ where: { id: u.id } })
    expect(u.mustChangePassword).toBe(true)
    expect(await verifyPassword('30123456', u.passwordHash)).toBe(true)
  })

  it('rechaza resetear un usuario sin DNI cargado', async () => {
    const legacy = await prisma.user.create({ data: { name: 'Legacy', email: 'legacy@a.com', passwordHash: 'x' } })
    const res = await resetUserPassword(legacy.id)
    expect(res).toEqual({ ok: false, error: 'Este usuario no tiene DNI cargado, no se puede resetear la contraseña' })
  })
})

describe('updateUserRole', () => {
  it('cambia el rol de un usuario', async () => {
    const u = await prisma.user.create({ data: { name: 'Dep', email: 'dep@a.com', passwordHash: 'x', role: 'DEPOSITO' } })
    expect(await updateUserRole(u.id, 'ADMIN')).toEqual({ ok: true })
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).role).toBe('ADMIN')
  })

  it('rechaza un rol inválido', async () => {
    const u = await prisma.user.create({ data: { name: 'X', email: 'x@a.com', passwordHash: 'x' } })
    expect(await updateUserRole(u.id, 'SUPERADMIN' as never)).toEqual({ ok: false, error: 'Rol inválido' })
  })

  it('rechaza quitar el rol ADMIN si no quedaría ningún administrador activo', async () => {
    const admin = await prisma.user.create({
      data: { name: 'Admin', email: 'admin@a.com', passwordHash: 'x', role: 'ADMIN', active: true },
    })
    expect(await updateUserRole(admin.id, 'DEPOSITO'))
      .toEqual({ ok: false, error: 'No se puede quitar el rol de ADMIN: no quedaría ningún administrador activo' })
    expect((await prisma.user.findUniqueOrThrow({ where: { id: admin.id } })).role).toBe('ADMIN')
  })

  it('permite quitar el rol ADMIN si hay otro administrador activo', async () => {
    const admin1 = await prisma.user.create({
      data: { name: 'A1', email: 'a1@a.com', passwordHash: 'x', role: 'ADMIN', active: true },
    })
    await prisma.user.create({ data: { name: 'A2', email: 'a2@a.com', passwordHash: 'x', role: 'ADMIN', active: true } })
    expect(await updateUserRole(admin1.id, 'DEPOSITO')).toEqual({ ok: true })
  })

  it('permite quitar el rol ADMIN a un admin ya inactivo (no cuenta como admin activo)', async () => {
    const inactiveAdmin = await prisma.user.create({
      data: { name: 'Inactivo', email: 'inactivo@a.com', passwordHash: 'x', role: 'ADMIN', active: false },
    })
    expect(await updateUserRole(inactiveAdmin.id, 'DEPOSITO')).toEqual({ ok: true })
  })
})

describe('setUserActive', () => {
  it('desactiva un usuario', async () => {
    const u = await prisma.user.create({ data: { name: 'X', email: 'x2@a.com', passwordHash: 'x' } })
    expect(await setUserActive(u.id, false)).toEqual({ ok: true })
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).active).toBe(false)
  })

  it('reactiva un usuario', async () => {
    const u = await prisma.user.create({ data: { name: 'X', email: 'x3@a.com', passwordHash: 'x', active: false } })
    expect(await setUserActive(u.id, true)).toEqual({ ok: true })
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).active).toBe(true)
  })

  it('rechaza desactivar si no quedaría ningún administrador activo', async () => {
    const admin = await prisma.user.create({
      data: { name: 'Admin', email: 'admin2@a.com', passwordHash: 'x', role: 'ADMIN', active: true },
    })
    expect(await setUserActive(admin.id, false))
      .toEqual({ ok: false, error: 'No se puede desactivar: no quedaría ningún administrador activo' })
    expect((await prisma.user.findUniqueOrThrow({ where: { id: admin.id } })).active).toBe(true)
  })

  it('permite desactivar un ADMIN si hay otro administrador activo', async () => {
    const admin1 = await prisma.user.create({
      data: { name: 'A1', email: 'a1b@a.com', passwordHash: 'x', role: 'ADMIN', active: true },
    })
    await prisma.user.create({ data: { name: 'A2', email: 'a2b@a.com', passwordHash: 'x', role: 'ADMIN', active: true } })
    expect(await setUserActive(admin1.id, false)).toEqual({ ok: true })
  })
})
