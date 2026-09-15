import { describe, expect, it, beforeEach, vi } from 'vitest'
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/server/auth/guards', () => ({
  requireUser: vi.fn().mockResolvedValue({ sub: 'u1', role: 'ADMIN', name: 'A' }),
  requireRole: vi.fn().mockResolvedValue({ sub: 'u1', role: 'ADMIN', name: 'A' }),
}))
import { prisma, resetDb } from '@/test/db'
import { createCategory, deleteCategory } from './categories'
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

describe('deleteCategory', () => {
  it('rechaza si tiene productos', async () => {
    await createCategory(undefined, fd('Mesas'))
    const cat = (await listCategories())[0]
    await prisma.product.create({ data: { name: 'Mesa Roble', categoryId: cat.id } })
    expect(await deleteCategory(cat.id)).toEqual({ ok: false, error: 'No se puede eliminar: tiene productos' })
    expect(await prisma.category.findUnique({ where: { id: cat.id } })).not.toBeNull()
  })
  it('elimina si no tiene productos', async () => {
    await createCategory(undefined, fd('Mesas'))
    const cat = (await listCategories())[0]
    expect(await deleteCategory(cat.id)).toEqual({ ok: true })
    expect(await prisma.category.findUnique({ where: { id: cat.id } })).toBeNull()
    expect(await listCategories()).toHaveLength(0)
  })
})
