import type { Prisma } from '@prisma/client'
import { beforeEach, describe, expect, it } from 'vitest'
import { prisma, resetDb } from '@/test/db'
import { resolveCustomer } from './resolve'

beforeEach(async () => { await resetDb() })
const run = <T,>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => prisma.$transaction(fn)

describe('resolveCustomer', () => {
  it('sin teléfono no asocia clienta', async () => {
    expect(await run((tx) => resolveCustomer(tx, { name: 'Ana' }))).toEqual({ ok: true })
  })

  it('reutiliza la clienta existente e ignora el nombre recibido', async () => {
    const c = await prisma.customer.create({ data: { name: 'Ana Gómez', phone: '1123456789' } })
    const r = await run((tx) => resolveCustomer(tx, { phone: '11 2345-6789', name: 'Otro' }))
    expect(r).toEqual({ ok: true, customerId: c.id, name: 'Ana Gómez', phone: '1123456789' })
    expect(await prisma.customer.count()).toBe(1)
  })

  it('crea a la clienta nueva con su nombre', async () => {
    const r = await run((tx) => resolveCustomer(tx, { phone: '1123456789', name: 'Bruno Díaz' }))
    expect(r).toMatchObject({ ok: true, name: 'Bruno Díaz', phone: '1123456789' })
    expect(await prisma.customer.count()).toBe(1)
  })

  it('rechaza teléfono corto y nombre faltante en clienta nueva', async () => {
    expect(await run((tx) => resolveCustomer(tx, { phone: '123' }))).toEqual({ ok: false, error: 'Teléfono inválido' })
    expect(await run((tx) => resolveCustomer(tx, { phone: '1123456789', name: ' ' }))).toEqual({ ok: false, error: 'Ingresá el nombre para registrar al cliente nuevo' })
    expect(await prisma.customer.count()).toBe(0)
  })
})
