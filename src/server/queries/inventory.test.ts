import { describe, expect, it, beforeEach } from 'vitest'
import { prisma, resetDb } from '@/test/db'
import { listStock, getVariantStock } from './inventory'

let vDisponible: string, vSinStock: string
beforeEach(async () => {
  await resetDb()
  const c = await prisma.category.create({ data: { name: 'Sillones', slug: 'sillones' } })
  const p = await prisma.product.create({
    data: {
      name: 'Sillón Milán', categoryId: c.id, defaultCost: 100, defaultPrice: 250,
      variants: {
        create: [
          { name: '2 cuerpos', price: 300 },   // override de precio
          { name: '3 cuerpos' },               // hereda 250
        ],
      },
    },
    include: { variants: true },
  })
  vDisponible = p.variants[0].id
  vSinStock = p.variants[1].id
  await prisma.inventoryStock.create({ data: { variantId: vDisponible, quantity: 5 } })
})

describe('listStock', () => {
  it('devuelve costo/precio efectivo y stock 0 cuando no hay InventoryStock', async () => {
    const { rows, totalVariants, totalUnits } = await listStock({})
    expect(totalVariants).toBe(2)
    expect(totalUnits).toBe(5)
    const r2 = rows.find((r) => r.variantName === '2 cuerpos')!
    expect(r2).toMatchObject({ quantity: 5, unitCost: 100, unitPrice: 300 })
    const r3 = rows.find((r) => r.variantName === '3 cuerpos')!
    expect(r3).toMatchObject({ quantity: 0, unitPrice: 250 })
  })
  it('filtra por estado disponible / sin_stock', async () => {
    expect((await listStock({ status: 'disponible' })).rows.map((r) => r.variantName)).toEqual(['2 cuerpos'])
    expect((await listStock({ status: 'sin_stock' })).rows.map((r) => r.variantName)).toEqual(['3 cuerpos'])
  })
  it('busca por nombre de producto o variante', async () => {
    expect((await listStock({ q: '3 cuerpos' })).rows).toHaveLength(1)
  })
})

describe('getVariantStock', () => {
  it('0 si no existe InventoryStock', async () => {
    expect(await getVariantStock(vSinStock)).toBe(0)
  })
  it('la cantidad si existe', async () => {
    expect(await getVariantStock(vDisponible)).toBe(5)
  })
})
