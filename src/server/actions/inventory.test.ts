import { describe, expect, it, beforeEach, vi } from 'vitest'
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/server/auth/guards', () => ({
  requireUser: vi.fn().mockResolvedValue({ sub: 'USER_ID', role: 'DEPOSITO', name: 'Ana' }),
}))
import { prisma, resetDb } from '@/test/db'
import { adjustStock } from './inventory'

let v1: string
beforeEach(async () => {
  await resetDb()
  const userId = (await prisma.user.create({ data: { email: 'a@a.com', name: 'Ana', passwordHash: 'x' } })).id
  vi.mocked((await import('@/server/auth/guards')).requireUser).mockResolvedValue({ sub: userId, role: 'DEPOSITO', name: 'Ana' })
  const c = await prisma.category.create({ data: { name: 'Mesas', slug: 'mesas' } })
  const p = await prisma.product.create({
    data: { name: 'Mesa', categoryId: c.id, variants: { create: [{ name: 'A' }] } },
    include: { variants: true },
  })
  v1 = p.variants[0].id
  await prisma.inventoryStock.create({ data: { variantId: v1, quantity: 3 } })
})

describe('adjustStock', () => {
  it('registra un AJUSTE con motivo y actualiza el stock', async () => {
    const res = await adjustStock({ variantId: v1, quantity: 1, note: 'Rotura en depósito' })
    expect(res).toMatchObject({ ok: true, delta: -2, quantityAfter: 1 })
    const t = await prisma.inventoryTransaction.findFirstOrThrow({ where: { variantId: v1, type: 'AJUSTE' } })
    expect(t).toMatchObject({ note: 'Rotura en depósito', quantityDelta: -2, quantityAfter: 1 })
  })
  it('rechaza motivo vacío', async () => {
    expect(await adjustStock({ variantId: v1, quantity: 2, note: '' }))
      .toEqual({ ok: false, error: 'El motivo es obligatorio' })
  })
  it('rechaza cantidad negativa', async () => {
    expect(await adjustStock({ variantId: v1, quantity: -1, note: 'x' }))
      .toEqual({ ok: false, error: 'No puede ser negativo' })
  })
})
