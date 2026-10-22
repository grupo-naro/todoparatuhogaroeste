import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { PrintStation } from './PrintStation'

const quote = (id: string) => ({
  id, kind: 'PRESUPUESTO' as const,
  quote: { lines: [{ productName: `Mesa ${id}`, variantName: 'A', unitPrice: 100, quantity: 1 }], total: 100, customerName: null, issuedAt: '2026-10-22T15:00:00.000Z' },
})

let events: string[]
let pendientes: (signal?: AbortSignal) => Promise<Response>
let marcar: (id: string) => Promise<Response>
const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }))

beforeEach(() => {
  vi.useFakeTimers()
  events = []
  marcar = (id) => { events.push(`mark:${id}`); return json({ ok: true }) }
  pendientes = () => json({ jobs: [] })
  vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
    if (url.includes('/pendientes')) { events.push('fetch'); return pendientes(init?.signal ?? undefined) }
    return marcar(JSON.parse(String(init?.body)).id)
  }))
  vi.spyOn(window, 'print').mockImplementation(() => { events.push('print') })
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

const tick = (ms = 0) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })

describe('PrintStation', () => {
  it('imprime cada trabajo en orden y lo marca solo después de imprimirlo', async () => {
    pendientes = () => json({ jobs: [quote('j1'), quote('j2')] })
    render(<PrintStation clave="k" />)
    await tick()
    expect(events.filter((e) => e !== 'fetch')).toEqual(['print', 'mark:j1', 'print', 'mark:j2'])
  })

  it('envía la clave en el header x-print-key', async () => {
    render(<PrintStation clave="mi-clave" />)
    await tick()
    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit
    expect(new Headers(init.headers).get('x-print-key')).toBe('mi-clave')
  })

  it('no vuelve a imprimir un trabajo que el servidor sigue listando', async () => {
    pendientes = () => json({ jobs: [quote('j1')] })
    render(<PrintStation clave="k" />)
    await tick()
    await tick(5000)
    await tick(5000)
    expect(events.filter((e) => e === 'print')).toHaveLength(1)
  })

  it('si imprimir falla no lo marca, y lo reintenta en la próxima revisión', async () => {
    pendientes = () => json({ jobs: [quote('j1')] })
    vi.mocked(window.print).mockImplementationOnce(() => { throw new Error('impresora apagada') })
    render(<PrintStation clave="k" />)
    await tick()
    expect(events).not.toContain('mark:j1')
    await tick(5000)
    expect(events).toContain('mark:j1')
  })

  it('una revisión lenta no dispara otra encima', async () => {
    pendientes = () => new Promise<Response>(() => {})
    render(<PrintStation clave="k" />)
    await tick(10000)
    expect(events.filter((e) => e === 'fetch')).toHaveLength(1)
  })

  it('un pedido colgado se corta a los 15 s, avisa "Sin conexión" y vuelve a intentar', async () => {
    pendientes = (signal) => new Promise<Response>((_, reject) => {
      signal?.addEventListener('abort', () => reject(new DOMException('abort', 'AbortError')))
    })
    render(<PrintStation clave="k" />)
    await tick(15000)
    expect(screen.getByText(/Sin conexión/)).toBeInTheDocument()
    pendientes = () => json({ jobs: [] })
    await tick(5000)
    expect(screen.getByText(/Conectada/)).toBeInTheDocument()
  })

  it('con 401 muestra "Clave incorrecta"', async () => {
    pendientes = () => json({ error: 'x' }, 401)
    render(<PrintStation clave="mala" />)
    await tick()
    expect(screen.getByText(/Clave incorrecta/)).toBeInTheDocument()
  })

  it('con error de red muestra el aviso de conexión y sigue reintentando', async () => {
    pendientes = () => Promise.reject(new Error('offline'))
    render(<PrintStation clave="k" />)
    await tick()
    expect(screen.getByText(/Sin conexión/)).toBeInTheDocument()
    pendientes = () => json({ jobs: [] })
    await tick(5000)
    expect(screen.getByText(/Conectada/)).toBeInTheDocument()
  })

  it('sin trabajos muestra "Conectada · última revisión"', async () => {
    render(<PrintStation clave="k" />)
    await tick()
    expect(screen.getByText(/Conectada · última revisión \d{2}:\d{2}:\d{2}/)).toBeInTheDocument()
  })
})
