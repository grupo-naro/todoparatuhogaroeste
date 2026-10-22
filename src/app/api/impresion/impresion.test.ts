import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { prisma, resetDb } from '@/test/db'
import { GET } from './pendientes/route'
import { POST } from './marcar/route'

const quote = { lines: [], total: 0, customerName: null, issuedAt: '2026-10-22T15:00:00.000Z' }

const get = (key?: string) =>
  GET(new Request('http://localhost/api/impresion/pendientes', { headers: key ? { 'x-print-key': key } : {} }))
const post = (body: unknown, key?: string) =>
  POST(new Request('http://localhost/api/impresion/marcar', {
    method: 'POST', body: JSON.stringify(body), headers: key ? { 'x-print-key': key } : {},
  }))

beforeEach(async () => {
  await resetDb()
  vi.stubEnv('PRINT_STATION_KEY', 'clave-correcta-123')
})
afterEach(() => vi.unstubAllEnvs())

describe('GET /api/impresion/pendientes', () => {
  it('responde 401 sin clave o con clave incorrecta', async () => {
    expect((await get()).status).toBe(401)
    expect((await get('mala')).status).toBe(401)
  })

  it('responde 401 siempre si PRINT_STATION_KEY no está configurada', async () => {
    vi.stubEnv('PRINT_STATION_KEY', '')
    expect((await get('')).status).toBe(401)
    expect((await get('cualquiera')).status).toBe(401)
  })

  it('responde 200 con los trabajos pendientes con la clave correcta', async () => {
    await prisma.printJob.create({ data: { kind: 'PRESUPUESTO', payload: quote } })
    const res = await get('clave-correcta-123')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.jobs).toHaveLength(1)
    expect(body.jobs[0]).toMatchObject({ kind: 'PRESUPUESTO', quote })
  })
})

describe('POST /api/impresion/marcar', () => {
  it('responde 401 sin clave válida y no marca nada', async () => {
    const job = await prisma.printJob.create({ data: { kind: 'PRESUPUESTO', payload: quote } })
    expect((await post({ id: job.id })).status).toBe(401)
    expect((await post({ id: job.id }, 'mala')).status).toBe(401)
    expect((await prisma.printJob.findUniqueOrThrow({ where: { id: job.id } })).printedAt).toBeNull()
  })

  it('marca el trabajo con la clave correcta', async () => {
    const job = await prisma.printJob.create({ data: { kind: 'PRESUPUESTO', payload: quote } })
    const res = await post({ id: job.id }, 'clave-correcta-123')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect((await prisma.printJob.findUniqueOrThrow({ where: { id: job.id } })).printedAt).not.toBeNull()
  })

  it('responde 400 si el id no es un uuid', async () => {
    expect((await post({ id: 'no-es-uuid' }, 'clave-correcta-123')).status).toBe(400)
    expect((await post({}, 'clave-correcta-123')).status).toBe(400)
  })
})
