import { describe, expect, it, beforeEach, vi } from 'vitest'
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/server/auth/guards', () => ({
  requireUser: vi.fn().mockResolvedValue({ sub: 'u1', role: 'ADMIN', name: 'A' }),
  requireRole: vi.fn().mockResolvedValue({ sub: 'u1', role: 'ADMIN', name: 'A' }),
}))
import { prisma, resetDb } from '@/test/db'
import { createCategory, archiveCategory } from './categories'
import { listCategories } from '@/server/queries/categories'

beforeEach(async () => { await resetDb() })
const fd = (name: string) => { const f = new FormData(); f.set('name', name); return f }

describe('createCategory', () => {
  it('crea con slug generado', async () => {
    expect(await createCategory(undefined, fd('Sillones Premium'))).toEqual({ ok: true })
    const cats = await listCategories()
    expect(cats[0]).toMatchObject({ name: 'Sillones Premium', slug: 'sillones-premium', activeProductCount: 0 })
  })
  it('rechaza nombre duplicado', async () => {
    await createCategory(undefined, fd('Mesas'))
    expect(await createCategory(undefined, fd('Mesas'))).toEqual({ ok: false, error: 'Ya existe una categoría con ese nombre' })
  })
})

describe('archiveCategory', () => {
  it('rechaza si tiene productos activos', async () => {
    await createCategory(undefined, fd('Mesas'))
    const cat = (await listCategories())[0]
    await prisma.product.create({ data: { name: 'Mesa Roble', categoryId: cat.id } })
    expect(await archiveCategory(cat.id)).toEqual({ ok: false, error: 'No se puede archivar: tiene productos activos' })
  })
  it('archiva si no tiene productos activos', async () => {
    await createCategory(undefined, fd('Mesas'))
    const cat = (await listCategories())[0]
    expect(await archiveCategory(cat.id)).toEqual({ ok: true })
    expect(await listCategories()).toHaveLength(0)
  })
})
