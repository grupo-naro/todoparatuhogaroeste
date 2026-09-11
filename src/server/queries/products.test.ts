import { describe, expect, it, beforeEach } from 'vitest'
import { prisma, resetDb } from '@/test/db'
// `getProduct` is exported by ./products (later tasks depend on it) but the
// brief's 5 tests don't exercise it; omitted from this import to keep lint clean.
import { listProducts, searchProductVariants } from './products'

let categoryId: string
beforeEach(async () => {
  await resetDb()
  const c = await prisma.category.create({ data: { name: 'Sillones', slug: 'sillones' } })
  categoryId = c.id
})

describe('listProducts', () => {
  it('lista productos activos con conteo de variantes y nombre de categoría', async () => {
    await prisma.product.create({
      data: { name: 'Sillón Milán', categoryId, defaultCost: 100, defaultPrice: 250,
        variants: { create: [{ name: '2 cuerpos' }, { name: '3 cuerpos' }] } },
    })
    const { rows, total } = await listProducts({})
    expect(total).toBe(1)
    expect(rows[0]).toMatchObject({ name: 'Sillón Milán', categoryName: 'Sillones', variantCount: 2, defaultCost: 100, defaultPrice: 250 })
  })
  it('filtra por q (nombre, case-insensitive) y por categoría', async () => {
    await prisma.product.create({ data: { name: 'Sillón Milán', categoryId } })
    await prisma.product.create({ data: { name: 'Sillón Oslo', categoryId } })
    expect((await listProducts({ q: 'oslo' })).rows).toHaveLength(1)
    // Brief adjustment: `categoryId` maps to a `@db.Uuid` column, so the non-UUID
    // literal 'otro-id' from the brief would make Postgres throw 22P02
    // (invalid input syntax for type uuid) and ERROR the test instead of asserting
    // an empty result. Swapped for a syntactically valid but nonexistent UUID —
    // the intent (filter by a category with no products → 0 rows) is preserved.
    expect((await listProducts({ categoryId: '00000000-0000-0000-0000-000000000000' })).rows).toHaveLength(0)
  })
  it('excluye archivados', async () => {
    await prisma.product.create({ data: { name: 'Viejo', categoryId, archivedAt: new Date() } })
    expect((await listProducts({})).total).toBe(0)
  })
})

describe('searchProductVariants', () => {
  it('encuentra por nombre de producto o de variante', async () => {
    await prisma.product.create({
      data: { name: 'Sillón Milán', categoryId, variants: { create: [{ name: '2 cuerpos Chenille' }] } },
    })
    expect(await searchProductVariants('milán')).toHaveLength(1)
    expect((await searchProductVariants('chenille'))[0]).toMatchObject({
      productName: 'Sillón Milán', variantName: '2 cuerpos Chenille', categoryName: 'Sillones',
    })
  })
  it('ignora consultas de menos de 2 caracteres', async () => {
    expect(await searchProductVariants('a')).toEqual([])
  })
})
