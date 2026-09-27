import { describe, expect, it, beforeEach } from 'vitest'
import { prisma, resetDb } from '@/test/db'
import { listPublicCatalog } from './catalog'

let categoryId: string

beforeEach(async () => {
  await resetDb()
  const c = await prisma.category.create({ data: { name: 'Sillones', slug: 'sillones' } })
  categoryId = c.id
})

describe('listPublicCatalog', () => {
  it('nunca incluye price, cost ni defaultPrice en la respuesta', async () => {
    await prisma.product.create({
      data: {
        name: 'Sillón Milán', categoryId, defaultPrice: 500, defaultCost: 300,
        variants: { create: [{ name: '2 cuerpos', price: 550, cost: 320 }] },
      },
    })
    const rows = await listPublicCatalog()
    expect(Object.keys(rows[0])).not.toContain('price')
    expect(Object.keys(rows[0])).not.toContain('cost')
    expect(Object.keys(rows[0])).not.toContain('defaultPrice')
    expect(Object.keys(rows[0].variants[0])).not.toContain('price')
    expect(Object.keys(rows[0].variants[0])).not.toContain('cost')
  })

  it('disponible es true con stock, false con stock en cero, false sin fila de stock', async () => {
    const p = await prisma.product.create({
      data: {
        name: 'Sillón Milán', categoryId, defaultPrice: 500,
        variants: { create: [
          { name: 'Con stock', price: 500 },
          { name: 'Sin stock', price: 500 },
          { name: 'Nunca stockeada', price: 500 },
        ] },
      },
      include: { variants: true },
    })
    const byName = Object.fromEntries(p.variants.map((v) => [v.name, v.id]))
    await prisma.inventoryStock.create({ data: { variantId: byName['Con stock'], quantity: 5 } })
    await prisma.inventoryStock.create({ data: { variantId: byName['Sin stock'], quantity: 0 } })

    const rows = await listPublicCatalog()
    const disponibleByName = Object.fromEntries(rows[0].variants.map((v) => [v.name, v.disponible]))
    expect(disponibleByName['Con stock']).toBe(true)
    expect(disponibleByName['Sin stock']).toBe(false)
    expect(disponibleByName['Nunca stockeada']).toBe(false)
  })

  it('filtra por categoryId cuando se pasa', async () => {
    const c2 = await prisma.category.create({ data: { name: 'Mesas', slug: 'mesas' } })
    await prisma.product.create({ data: { name: 'Sillón Milán', categoryId, defaultPrice: 500, variants: { create: [{ name: 'A', price: 500 }] } } })
    await prisma.product.create({ data: { name: 'Mesa Roble', categoryId: c2.id, defaultPrice: 800, variants: { create: [{ name: 'A', price: 800 }] } } })

    const rows = await listPublicCatalog({ categoryId })
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('Sillón Milán')
  })

  it('sin categoryId trae productos de todas las categorías', async () => {
    const c2 = await prisma.category.create({ data: { name: 'Mesas', slug: 'mesas' } })
    await prisma.product.create({ data: { name: 'Sillón Milán', categoryId, defaultPrice: 500, variants: { create: [{ name: 'A', price: 500 }] } } })
    await prisma.product.create({ data: { name: 'Mesa Roble', categoryId: c2.id, defaultPrice: 800, variants: { create: [{ name: 'A', price: 800 }] } } })

    const rows = await listPublicCatalog()
    expect(rows).toHaveLength(2)
  })

  it('un producto sin fotos devuelve un array de imágenes vacío, sin romper', async () => {
    await prisma.product.create({ data: { name: 'Sillón Milán', categoryId, defaultPrice: 500, variants: { create: [{ name: 'A', price: 500 }] } } })
    const rows = await listPublicCatalog()
    expect(rows[0].images).toEqual([])
  })

  it('un categoryId con formato inválido (no UUID) no rompe — trae todos los productos', async () => {
    await prisma.product.create({ data: { name: 'Sillón Milán', categoryId, defaultPrice: 500, variants: { create: [{ name: 'A', price: 500 }] } } })
    const rows = await listPublicCatalog({ categoryId: 'sillones' }) // slug, no UUID — exactamente lo que alguien probaría a mano
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('Sillón Milán')
  })

  it('q busca por nombre de producto, sin distinguir mayúsculas', async () => {
    await prisma.product.create({ data: { name: 'Sillón Milán', categoryId, defaultPrice: 500, variants: { create: [{ name: 'A', price: 500 }] } } })
    await prisma.product.create({ data: { name: 'Mesa Roble', categoryId, defaultPrice: 800, variants: { create: [{ name: 'A', price: 800 }] } } })

    const rows = await listPublicCatalog({ q: 'milán' })
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('Sillón Milán')
  })

  it('q también busca por nombre de variante (medida/tela/color)', async () => {
    await prisma.product.create({
      data: {
        name: 'Sillón Milán', categoryId, defaultPrice: 500,
        variants: { create: [{ name: '2 cuerpos · Tela A · Azul', price: 500 }] },
      },
    })
    await prisma.product.create({ data: { name: 'Mesa Roble', categoryId, defaultPrice: 800, variants: { create: [{ name: 'A', price: 800 }] } } })

    const rows = await listPublicCatalog({ q: 'azul' })
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('Sillón Milán')
  })

  it('q y categoryId se combinan (AND, no OR)', async () => {
    const c2 = await prisma.category.create({ data: { name: 'Mesas', slug: 'mesas' } })
    await prisma.product.create({ data: { name: 'Sillón Milán', categoryId, defaultPrice: 500, variants: { create: [{ name: 'A', price: 500 }] } } })
    await prisma.product.create({ data: { name: 'Mesa Milán', categoryId: c2.id, defaultPrice: 800, variants: { create: [{ name: 'A', price: 800 }] } } })

    const rows = await listPublicCatalog({ categoryId, q: 'milán' })
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('Sillón Milán')
  })

  it('sin q, se comporta igual que antes (trae todo, filtrado solo por categoría si se pasa)', async () => {
    await prisma.product.create({ data: { name: 'Sillón Milán', categoryId, defaultPrice: 500, variants: { create: [{ name: 'A', price: 500 }] } } })
    const rows = await listPublicCatalog()
    expect(rows).toHaveLength(1)
  })
})
