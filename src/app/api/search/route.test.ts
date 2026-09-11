import { describe, expect, it, beforeEach, vi } from 'vitest'
vi.mock('@/server/auth/guards', () => ({ requireUser: vi.fn().mockResolvedValue({ sub: 'u1' }) }))
import { prisma, resetDb } from '@/test/db'
import { GET } from './route'

beforeEach(async () => {
  await resetDb()
  const c = await prisma.category.create({ data: { name: 'Sillones', slug: 'sillones' } })
  await prisma.product.create({
    data: { name: 'Sillón Milán', categoryId: c.id, variants: { create: [{ name: '2 cuerpos' }] } },
  })
})

const req = (q: string) => new Request(`http://localhost/api/search?q=${encodeURIComponent(q)}`)

describe('GET /api/search', () => {
  it('devuelve coincidencias', async () => {
    const res = await GET(req('milán'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.results[0]).toMatchObject({ productName: 'Sillón Milán', variantName: '2 cuerpos' })
  })
  it('q corta → results vacío', async () => {
    const body = await (await GET(req('a'))).json()
    expect(body.results).toEqual([])
  })
})
