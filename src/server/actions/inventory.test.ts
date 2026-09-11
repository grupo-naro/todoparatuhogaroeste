import { describe, expect, it, beforeEach, vi } from 'vitest'
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/server/auth/guards', () => ({
  requireUser: vi.fn().mockResolvedValue({ sub: 'USER_ID', role: 'DEPOSITO', name: 'Ana' }),
}))
import { prisma, resetDb } from '@/test/db'
import { saveInitialStockBatch } from './inventory'

let v1: string, v2: string, userId: string
beforeEach(async () => {
  await resetDb()
  userId = (await prisma.user.create({ data: { email: 'a@a.com', name: 'Ana', passwordHash: 'x' } })).id
  vi.mocked((await import('@/server/auth/guards')).requireUser).mockResolvedValue({ sub: userId, role: 'DEPOSITO', name: 'Ana' })
  const c = await prisma.category.create({ data: { name: 'Mesas', slug: 'mesas' } })
  const p = await prisma.product.create({
    data: { name: 'Mesa', categoryId: c.id, variants: { create: [{ name: 'A' }, { name: 'B' }] } },
    include: { variants: true },
  })
  v1 = p.variants[0].id; v2 = p.variants[1].id
  await prisma.inventoryStock.create({ data: { variantId: v1, quantity: 3 } })
})

describe('saveInitialStockBatch', () => {
  it('ajuste absoluto: el stock queda en lo contado y registra el delta', async () => {
    const res = await saveInitialStockBatch([{ variantId: v1, counted: 8 }, { variantId: v2, counted: 4 }])
    expect(res.saved).toBe(2)
    expect(res.failed).toBe(0)
    expect(await prisma.inventoryStock.findUniqueOrThrow({ where: { variantId: v1 } })).toMatchObject({ quantity: 8 })
    expect(await prisma.inventoryStock.findUniqueOrThrow({ where: { variantId: v2 } })).toMatchObject({ quantity: 4 })
    const t1 = await prisma.inventoryTransaction.findFirstOrThrow({ where: { variantId: v1 } })
    expect(t1).toMatchObject({ type: 'CARGA_INICIAL', quantityDelta: 5, quantityAfter: 8, userId })
    const t2 = await prisma.inventoryTransaction.findFirstOrThrow({ where: { variantId: v2 } })
    expect(t2).toMatchObject({ quantityDelta: 4, quantityAfter: 4 })
    expect(t1.batchId).toBe(t2.batchId)
    expect(t1.batchId).not.toBeNull()
  })
  it('descarta filas inválidas y guarda las válidas', async () => {
    const res = await saveInitialStockBatch([
      { variantId: v1, counted: 10 },
      { variantId: v2, counted: -2 },
      { variantId: 'no-uuid', counted: 1 },
    ])
    expect(res.saved).toBe(1)
    expect(res.failed).toBe(2)
    expect(res.results.filter((r) => !r.ok).map((r) => r.error)).toContain('No puede ser negativo')
    expect(await prisma.inventoryStock.findUniqueOrThrow({ where: { variantId: v1 } })).toMatchObject({ quantity: 10 })
  })
  it('recontar registra un segundo movimiento con el nuevo delta', async () => {
    await saveInitialStockBatch([{ variantId: v1, counted: 8 }])   // delta +5, after 8
    await saveInitialStockBatch([{ variantId: v1, counted: 6 }])   // delta -2, after 6
    const ts = await prisma.inventoryTransaction.findMany({ where: { variantId: v1 }, orderBy: { createdAt: 'asc' } })
    expect(ts.map((t) => [t.quantityDelta, t.quantityAfter])).toEqual([[5, 8], [-2, 6]])
    expect(ts[0].batchId).not.toBe(ts[1].batchId) // separate calls get separate batchIds
    expect(await prisma.inventoryStock.findUniqueOrThrow({ where: { variantId: v1 } })).toMatchObject({ quantity: 6 })
  })
  it('rechaza un lote vacío', async () => {
    await expect(saveInitialStockBatch([])).rejects.toThrow()
  })

  it('si una fila válida-en-formato no existe en la BD, todo el lote falla sin persistir nada', async () => {
    const fakeVariantId = '00000000-0000-0000-0000-000000000000' // uuid válido, no existe
    const before = await prisma.inventoryStock.findUnique({ where: { variantId: v1 } })
    const res = await saveInitialStockBatch([
      { variantId: v1, counted: 99 },       // otherwise valid
      { variantId: fakeVariantId, counted: 1 }, // passes zod, fails at DB (FK violation)
    ])
    expect(res.saved).toBe(0)
    expect(res.failed).toBe(2)
    expect(res.results.every((r) => !r.ok && r.error === 'No se pudo guardar el lote')).toBe(true)
    // v1's stock must be UNCHANGED — the whole transaction rolled back
    const after = await prisma.inventoryStock.findUnique({ where: { variantId: v1 } })
    expect(after?.quantity).toBe(before?.quantity ?? 0)
  })
})
