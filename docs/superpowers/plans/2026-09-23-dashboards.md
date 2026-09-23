# Dashboards por rol (ADMIN / VENDEDOR) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el redirect fijo de `/` a `/productos` por un dashboard que se adapta al rol logueado — ADMIN ve números del negocio (facturación, ventas, clientes nuevos, anulaciones, stock bajo) y VENDEDOR ve solo la cantidad de pedidos que hizo, ambos con selector de período (Hoy/Semana/Mes).

**Architecture:** Una función pura (`getPeriodRange`) calcula los límites de período en hora argentina sin dependencias externas. Un nuevo archivo de queries (`dashboard.ts`) agrega esos límites contra Prisma. `/` se vuelve un Server Component que decide qué dashboard renderizar según el rol de la sesión, con el período leído de `?period=` en la URL (mismo patrón que `/deposito`).

**Tech Stack:** Next.js 16 App Router (Server Components), Prisma 7 + PostgreSQL, Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-23-dashboards-design.md`

## Global Constraints

- Next.js 16 App Router: `searchParams` en una página es `Promise<...>`, hay que `await`earlo.
- Los límites de período se calculan SIEMPRE con `getPeriodRange` (Task 1) — nunca `new Date().setHours(0,0,0,0)` directo, que usaría el huso horario del servidor (UTC en Vercel), no el de Argentina.
- Nunca devolver un `Prisma.Decimal` crudo desde una query — pasar siempre por `toNumber()` (`@/lib/pricing`).
- "Ventas activas" (facturación, cantidad de ventas, pedidos de una vendedora) siempre excluyen `cancelledAt: null` como condición — mismo criterio ya usado en `src/server/queries/customers.ts` y `src/server/actions/sales.ts`. La única métrica que SÍ filtra por `cancelledAt` (en vez de excluirlo) es la cuenta de anulaciones.
- Umbral de stock bajo: una única constante `LOW_STOCK_THRESHOLD = 3` exportada desde `dashboard.ts`, no repetir el número mágico en otro lado.
- No hay cambios de schema/Prisma en este plan — no hace falta ninguna migración.
- Cada commit termina con: `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

## Review Focus

- VENDEDOR nunca debe ver ningún monto en pesos en su dashboard — solo la cantidad de pedidos. Test dedicado en Task 3 (`VendedorDashboard.test.tsx`) que verifica que no aparece ningún `$` en el DOM.
- Los límites de período no deben "correrse" un día por el huso horario UTC del servidor — el caso más peligroso es cerca de medianoche argentina o cerca de fin de mes. Cubierto exhaustivamente en Task 1 (`period.test.ts`), con casos específicamente cerca de esos bordes.
- La alerta de stock bajo es una foto del momento, no debe cambiar según el período elegido. Task 2 lo prueba explícitamente llamando `getAdminDashboardStats` con dos períodos distintos sobre el mismo estado de stock y comparando el resultado.
- Un `?period=` con un valor que no sea `day`/`week`/`month` (typo, manipulación manual de la URL) no debe romper la página — debe caer al default `day`. Cubierto en Task 4 (`page.test.tsx`).
- DEPOSITO entrando a `/` debe seguir yendo a `/productos` como hoy — ningún cambio de este plan debe tocar ese comportamiento para ese rol. Cubierto en Task 4.

---

### Task 1: Cálculo de períodos en hora argentina

**Files:**
- Create: `src/lib/period.ts`
- Test: `src/lib/period.test.ts`

**Interfaces:**
- Consumes: nada (función pura, sin dependencias del proyecto).
- Produces: `export type Period = 'day' | 'week' | 'month'`, `export function getPeriodRange(period: Period, now?: Date): { from: Date; to: Date }`.

- [ ] **Step 1: Test que falla — `src/lib/period.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { getPeriodRange } from './period'

describe('getPeriodRange', () => {
  it('day: límites básicos un miércoles a media mañana en Argentina', () => {
    const now = new Date('2026-09-23T14:00:00Z') // 11:00 en Argentina
    const { from, to } = getPeriodRange('day', now)
    expect(from).toEqual(new Date('2026-09-23T03:00:00Z')) // medianoche argentina del mismo día
    expect(to).toEqual(now)
  })

  it('week: el mismo miércoles, arranca el lunes de esa semana', () => {
    const now = new Date('2026-09-23T14:00:00Z')
    const { from } = getPeriodRange('week', now)
    expect(from).toEqual(new Date('2026-09-21T03:00:00Z')) // lunes 21/09
  })

  it('month: el mismo miércoles, arranca el día 1 del mes', () => {
    const now = new Date('2026-09-23T14:00:00Z')
    const { from } = getPeriodRange('month', now)
    expect(from).toEqual(new Date('2026-09-01T03:00:00Z'))
  })

  it('day: un minuto antes de medianoche argentina todavía es el día anterior', () => {
    const now = new Date('2026-09-23T02:59:00Z') // 23:59 del 22/09 en Argentina
    const { from } = getPeriodRange('day', now)
    expect(from).toEqual(new Date('2026-09-22T03:00:00Z'))
  })

  it('day: exactamente en medianoche argentina, from coincide con now', () => {
    const now = new Date('2026-09-23T03:00:00Z') // 00:00 en Argentina
    const { from, to } = getPeriodRange('day', now)
    expect(from).toEqual(now)
    expect(to).toEqual(now)
  })

  it('day y month: la 1am UTC del día 1 todavía es el mes anterior en Argentina', () => {
    const now = new Date('2026-03-01T01:00:00Z') // 22:00 del 28/02 en Argentina
    expect(getPeriodRange('day', now).from).toEqual(new Date('2026-02-28T03:00:00Z'))
    expect(getPeriodRange('month', now).from).toEqual(new Date('2026-02-01T03:00:00Z'))
  })

  it('week: domingo va al lunes anterior, no al siguiente', () => {
    const now = new Date('2023-01-01T12:00:00Z') // domingo, 09:00 en Argentina
    const { from } = getPeriodRange('week', now)
    expect(from).toEqual(new Date('2022-12-26T03:00:00Z')) // lunes 26/12/2022
  })

  it('week: cruza fin de mes correctamente', () => {
    const now = new Date('2026-03-01T12:00:00Z') // domingo, 09:00 en Argentina
    const { from } = getPeriodRange('week', now)
    expect(from).toEqual(new Date('2026-02-23T03:00:00Z')) // lunes 23/02
  })

  it('sin "now" explícito, usa la hora actual real', () => {
    const before = Date.now()
    const { to } = getPeriodRange('day')
    expect(to.getTime()).toBeGreaterThanOrEqual(before)
  })
})
```

- [ ] **Step 2: Ejecutar — debe fallar.** Run: `pnpm test src/lib/period.test.ts` → FAIL (`period.ts` no existe).

- [ ] **Step 3: Implementar `src/lib/period.ts`**

```ts
export type Period = 'day' | 'week' | 'month'

const AR_OFFSET_MS = 3 * 60 * 60 * 1000 // Argentina = UTC-3, sin horario de verano

export function getPeriodRange(period: Period, now: Date = new Date()): { from: Date; to: Date } {
  const arNow = new Date(now.getTime() - AR_OFFSET_MS)
  const from = new Date(Date.UTC(arNow.getUTCFullYear(), arNow.getUTCMonth(), arNow.getUTCDate()))

  if (period === 'week') {
    // Lunes como inicio de semana. getUTCDay(): 0=domingo..6=sábado.
    const dayOfWeek = from.getUTCDay()
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    from.setUTCDate(from.getUTCDate() - diffToMonday)
  } else if (period === 'month') {
    from.setUTCDate(1)
  }

  return { from: new Date(from.getTime() + AR_OFFSET_MS), to: now }
}
```

- [ ] **Step 4: Ejecutar — debe pasar.** Run: `pnpm test src/lib/period.test.ts` → PASS (todo el archivo, 9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/period.ts src/lib/period.test.ts
git commit -m "feat: getPeriodRange calcula límites de día/semana/mes en hora argentina"
```

---

### Task 2: Queries de estadísticas — `src/server/queries/dashboard.ts`

**Files:**
- Create: `src/server/queries/dashboard.ts`
- Test: `src/server/queries/dashboard.test.ts`

**Interfaces:**
- Consumes: `Period`, `getPeriodRange` (Task 1, `@/lib/period`); `toNumber` (`@/lib/pricing`, ya existe); `prisma` (`@/server/db`, ya existe).
- Produces: `export const LOW_STOCK_THRESHOLD = 3`; `export type AdminDashboardStats = { totalFacturado: number; cantidadVentas: number; clientesNuevos: number; ventasAnuladas: number; stockBajo: { variantId: string; productName: string; variantName: string; quantity: number }[] }`; `export async function getAdminDashboardStats(period: Period): Promise<AdminDashboardStats>`; `export type VendedorDashboardStats = { cantidadPedidos: number }`; `export async function getVendedorDashboardStats(userId: string, period: Period): Promise<VendedorDashboardStats>`.

- [ ] **Step 1: Test que falla — `src/server/queries/dashboard.test.ts`**

```ts
import { describe, expect, it, beforeEach } from 'vitest'
import { prisma, resetDb } from '@/test/db'
import { getAdminDashboardStats, getVendedorDashboardStats, LOW_STOCK_THRESHOLD } from './dashboard'

let userId: string, v1: string, categoryId: string

const OLD = new Date('2020-01-01T12:00:00Z') // muy afuera de cualquier período posible

beforeEach(async () => {
  await resetDb()
  userId = (await prisma.user.create({ data: { email: 'a@a.com', name: 'Ana', passwordHash: 'x', role: 'VENDEDOR' } })).id
  const c = await prisma.category.create({ data: { name: 'Mesas', slug: 'mesas' } })
  categoryId = c.id
  const p = await prisma.product.create({
    data: { name: 'Mesa', categoryId, defaultPrice: 100, variants: { create: [{ name: 'A', price: 100 }] } },
    include: { variants: true },
  })
  v1 = p.variants[0].id
})

async function makeSale(overrides: { createdAt?: Date; cancelledAt?: Date | null; total?: number; userId?: string } = {}) {
  return prisma.sale.create({
    data: {
      userId: overrides.userId ?? userId,
      paymentMethod: 'EFECTIVO',
      total: overrides.total ?? 100,
      createdAt: overrides.createdAt ?? new Date(),
      cancelledAt: overrides.cancelledAt ?? null,
      items: { create: [{ variantId: v1, quantity: 1, unitPrice: 100, subtotal: 100 }] },
    },
  })
}

describe('getAdminDashboardStats', () => {
  it('cuenta y suma solo ventas no anuladas del período, ignora ventas viejas', async () => {
    await makeSale({ total: 100 })
    await makeSale({ total: 50 })
    await makeSale({ createdAt: OLD, total: 999 }) // vieja, no cuenta
    await makeSale({ total: 30, cancelledAt: new Date() }) // anulada, no cuenta en facturación
    const stats = await getAdminDashboardStats('month')
    expect(stats.cantidadVentas).toBe(2)
    expect(stats.totalFacturado).toBe(150)
  })

  it('sin ninguna venta en el período, factura 0 sin romper', async () => {
    const stats = await getAdminDashboardStats('day')
    expect(stats).toMatchObject({ totalFacturado: 0, cantidadVentas: 0 })
  })

  it('clientesNuevos cuenta por fecha de alta, ignora clientes viejos', async () => {
    await prisma.customer.create({ data: { name: 'Nueva', phone: '1111111111' } })
    await prisma.customer.create({ data: { name: 'Vieja', phone: '2222222222', createdAt: OLD } })
    const stats = await getAdminDashboardStats('day')
    expect(stats.clientesNuevos).toBe(1)
  })

  it('ventasAnuladas cuenta por fecha de anulación, no por fecha de creación de la venta', async () => {
    await makeSale({ createdAt: OLD, cancelledAt: new Date() }) // vieja al crearse, anulada ahora: cuenta
    await makeSale({ cancelledAt: OLD }) // creada ahora, anulada hace mucho: no cuenta en este período
    const stats = await getAdminDashboardStats('month')
    expect(stats.ventasAnuladas).toBe(1)
  })

  it('stockBajo devuelve solo variantes en o debajo del umbral, ordenadas ascendente', async () => {
    const p2 = await prisma.product.create({
      data: {
        name: 'Silla', categoryId, defaultPrice: 50,
        variants: { create: [{ name: 'Roja', price: 50 }, { name: 'Azul', price: 50 }, { name: 'Verde', price: 50 }] },
      },
      include: { variants: true },
    })
    await prisma.inventoryStock.create({ data: { variantId: v1, quantity: 10 } }) // por encima del umbral, no aparece
    await prisma.inventoryStock.create({ data: { variantId: p2.variants[0].id, quantity: LOW_STOCK_THRESHOLD } }) // justo en el umbral
    await prisma.inventoryStock.create({ data: { variantId: p2.variants[1].id, quantity: 0 } })
    await prisma.inventoryStock.create({ data: { variantId: p2.variants[2].id, quantity: 1 } })

    const stats = await getAdminDashboardStats('day')
    expect(stats.stockBajo.map((v) => v.quantity)).toEqual([0, 1, LOW_STOCK_THRESHOLD])
    expect(stats.stockBajo[0]).toMatchObject({ productName: 'Silla', variantName: 'Azul', quantity: 0 })
  })

  it('stockBajo no depende del período elegido', async () => {
    await prisma.inventoryStock.create({ data: { variantId: v1, quantity: 1 } })
    const day = await getAdminDashboardStats('day')
    const month = await getAdminDashboardStats('month')
    expect(day.stockBajo).toEqual(month.stockBajo)
  })
})

describe('getVendedorDashboardStats', () => {
  it('cuenta solo las ventas no anuladas de esa vendedora en el período', async () => {
    const otroId = (await prisma.user.create({ data: { email: 'b@b.com', name: 'Bruno', passwordHash: 'x', role: 'VENDEDOR' } })).id
    await makeSale()
    await makeSale()
    await makeSale({ cancelledAt: new Date() }) // anulada, no cuenta
    await makeSale({ createdAt: OLD }) // vieja, no cuenta
    await makeSale({ userId: otroId }) // de otra persona, no cuenta

    const stats = await getVendedorDashboardStats(userId, 'month')
    expect(stats.cantidadPedidos).toBe(2)
  })

  it('sin ninguna venta, devuelve 0 sin romper', async () => {
    const stats = await getVendedorDashboardStats(userId, 'day')
    expect(stats).toEqual({ cantidadPedidos: 0 })
  })
})
```

- [ ] **Step 2: Ejecutar — debe fallar.** Run: `pnpm test src/server/queries/dashboard.test.ts` → FAIL (`dashboard.ts` no existe). Requiere que el contenedor de test de Docker esté levantado (`pnpm run test:db:up` si no lo está) — mismo entorno que el resto de las queries de este proyecto.

- [ ] **Step 3: Implementar `src/server/queries/dashboard.ts`**

```ts
import { prisma } from '@/server/db'
import { toNumber } from '@/lib/pricing'
import { getPeriodRange, type Period } from '@/lib/period'

export const LOW_STOCK_THRESHOLD = 3

export type AdminDashboardStats = {
  totalFacturado: number
  cantidadVentas: number
  clientesNuevos: number
  ventasAnuladas: number
  stockBajo: { variantId: string; productName: string; variantName: string; quantity: number }[]
}

export async function getAdminDashboardStats(period: Period): Promise<AdminDashboardStats> {
  const { from, to } = getPeriodRange(period)
  const ventasWhere = { cancelledAt: null, createdAt: { gte: from, lte: to } }

  const [cantidadVentas, sumResult, clientesNuevos, ventasAnuladas, stockBajoRows] = await Promise.all([
    prisma.sale.count({ where: ventasWhere }),
    prisma.sale.aggregate({ where: ventasWhere, _sum: { total: true } }),
    prisma.customer.count({ where: { createdAt: { gte: from, lte: to } } }),
    prisma.sale.count({ where: { cancelledAt: { gte: from, lte: to } } }),
    prisma.productVariant.findMany({
      where: { stock: { quantity: { lte: LOW_STOCK_THRESHOLD } } },
      include: { stock: true, product: { select: { name: true } } },
      orderBy: { stock: { quantity: 'asc' } },
      take: 5,
    }),
  ])

  return {
    totalFacturado: toNumber(sumResult._sum.total) ?? 0,
    cantidadVentas,
    clientesNuevos,
    ventasAnuladas,
    stockBajo: stockBajoRows.map((v) => ({
      variantId: v.id, productName: v.product.name, variantName: v.name, quantity: v.stock?.quantity ?? 0,
    })),
  }
}

export type VendedorDashboardStats = { cantidadPedidos: number }

export async function getVendedorDashboardStats(userId: string, period: Period): Promise<VendedorDashboardStats> {
  const { from, to } = getPeriodRange(period)
  const cantidadPedidos = await prisma.sale.count({
    where: { userId, cancelledAt: null, createdAt: { gte: from, lte: to } },
  })
  return { cantidadPedidos }
}
```

- [ ] **Step 4: Ejecutar — debe pasar.** Run: `pnpm test src/server/queries/dashboard.test.ts` → PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/server/queries/dashboard.ts src/server/queries/dashboard.test.ts
git commit -m "feat: queries de estadísticas para dashboard de ADMIN y VENDEDOR"
```

---

### Task 3: Componentes de dashboard

**Files:**
- Create: `src/components/dashboard/PeriodSelector.tsx`
- Test: `src/components/dashboard/PeriodSelector.test.tsx`
- Create: `src/components/dashboard/StatCard.tsx`
- Test: `src/components/dashboard/StatCard.test.tsx`
- Create: `src/components/dashboard/AdminDashboard.tsx`
- Test: `src/components/dashboard/AdminDashboard.test.tsx`
- Create: `src/components/dashboard/VendedorDashboard.tsx`
- Test: `src/components/dashboard/VendedorDashboard.test.tsx`

**Interfaces:**
- Consumes: `Period` (Task 1, `@/lib/period`); `AdminDashboardStats`, `VendedorDashboardStats` (Task 2, `@/server/queries/dashboard`); `money`, `integer` (`@/lib/format`, ya existen).
- Produces: `<PeriodSelector period={Period} />`; `<StatCard label={string} value={string} />`; `<AdminDashboard stats={AdminDashboardStats} period={Period} />`; `<VendedorDashboard stats={VendedorDashboardStats} period={Period} />`.

- [ ] **Step 1: Test que falla — `src/components/dashboard/PeriodSelector.test.tsx`**

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(''),
}))
import { PeriodSelector } from './PeriodSelector'

describe('PeriodSelector', () => {
  it('marca el período actual como presionado', () => {
    render(<PeriodSelector period="week" />)
    expect(screen.getByRole('button', { name: 'Semana' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Hoy' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('empuja ?period=month al hacer click en Mes', async () => {
    render(<PeriodSelector period="day" />)
    await userEvent.click(screen.getByRole('button', { name: 'Mes' }))
    expect(push).toHaveBeenCalledWith('/?period=month')
  })
})
```

- [ ] **Step 2: Ejecutar — debe fallar.** Run: `pnpm test src/components/dashboard/PeriodSelector.test.tsx` → FAIL.

- [ ] **Step 3: Implementar `src/components/dashboard/PeriodSelector.tsx`**

```tsx
'use client'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { Period } from '@/lib/period'

const OPTIONS: { value: Period; label: string }[] = [
  { value: 'day', label: 'Hoy' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
]

export function PeriodSelector({ period }: { period: Period }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function handleChange(value: Period) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('period', value)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex gap-2 mb-4" role="group" aria-label="Período">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={period === opt.value}
          onClick={() => handleChange(opt.value)}
          className={`px-3 min-h-11 rounded text-sm font-medium ${
            period === opt.value ? 'bg-primary text-primary-foreground' : 'border border-border'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Ejecutar — debe pasar.** Run: `pnpm test src/components/dashboard/PeriodSelector.test.tsx` → PASS.

- [ ] **Step 5: Test que falla — `src/components/dashboard/StatCard.test.tsx`**

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatCard } from './StatCard'

describe('StatCard', () => {
  it('muestra el label y el valor', () => {
    render(<StatCard label="Ventas" value="12" />)
    expect(screen.getByText('Ventas')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
  })
})
```

- [ ] **Step 6: Ejecutar — debe fallar.** Run: `pnpm test src/components/dashboard/StatCard.test.tsx` → FAIL.

- [ ] **Step 7: Implementar `src/components/dashboard/StatCard.tsx`**

```tsx
export function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border rounded-lg p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
    </div>
  )
}
```

- [ ] **Step 8: Ejecutar — debe pasar.** Run: `pnpm test src/components/dashboard/StatCard.test.tsx` → PASS.

- [ ] **Step 9: Test que falla — `src/components/dashboard/AdminDashboard.test.tsx`**

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(''),
}))
import { AdminDashboard } from './AdminDashboard'
import type { AdminDashboardStats } from '@/server/queries/dashboard'

const baseStats: AdminDashboardStats = {
  totalFacturado: 1500, cantidadVentas: 3, clientesNuevos: 2, ventasAnuladas: 1, stockBajo: [],
}

describe('AdminDashboard', () => {
  it('muestra las 4 métricas formateadas', () => {
    render(<AdminDashboard stats={baseStats} period="day" />)
    expect(screen.getByText(/^\$\s*1\.500,00$/)).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('muestra "Todo con stock" si no hay alertas', () => {
    render(<AdminDashboard stats={baseStats} period="day" />)
    expect(screen.getByText('Todo con stock')).toBeInTheDocument()
  })

  it('lista las variantes con stock bajo', () => {
    const stats: AdminDashboardStats = {
      ...baseStats,
      stockBajo: [{ variantId: 'v1', productName: 'Mesa', variantName: 'Chica', quantity: 2 }],
    }
    render(<AdminDashboard stats={stats} period="day" />)
    expect(screen.getByText(/Mesa/)).toBeInTheDocument()
    expect(screen.getByText(/Chica/)).toBeInTheDocument()
    expect(screen.getByText(/Quedan 2/)).toBeInTheDocument()
    expect(screen.queryByText('Todo con stock')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 10: Ejecutar — debe fallar.** Run: `pnpm test src/components/dashboard/AdminDashboard.test.tsx` → FAIL.

- [ ] **Step 11: Implementar `src/components/dashboard/AdminDashboard.tsx`**

```tsx
import type { AdminDashboardStats } from '@/server/queries/dashboard'
import type { Period } from '@/lib/period'
import { PeriodSelector } from './PeriodSelector'
import { StatCard } from './StatCard'
import { money, integer } from '@/lib/format'

export function AdminDashboard({ stats, period }: { stats: AdminDashboardStats; period: Period }) {
  return (
    <section>
      <h1 className="text-xl font-semibold mb-4">Inicio</h1>
      <PeriodSelector period={period} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total facturado" value={money(stats.totalFacturado)} />
        <StatCard label="Ventas" value={integer(stats.cantidadVentas)} />
        <StatCard label="Clientes nuevos" value={integer(stats.clientesNuevos)} />
        <StatCard label="Ventas anuladas" value={integer(stats.ventasAnuladas)} />
      </div>
      <h2 className="text-lg font-semibold mb-2">Stock bajo</h2>
      {stats.stockBajo.length === 0 ? (
        <p className="text-muted">Todo con stock</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {stats.stockBajo.map((v) => (
            <li key={v.variantId} className="flex items-center justify-between border border-border rounded-lg p-3">
              <span>{v.productName} · {v.variantName}</span>
              <span className="text-sm text-muted">Quedan {v.quantity}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
```

- [ ] **Step 12: Ejecutar — debe pasar.** Run: `pnpm test src/components/dashboard/AdminDashboard.test.tsx` → PASS.

- [ ] **Step 13: Test que falla — `src/components/dashboard/VendedorDashboard.test.tsx`**

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(''),
}))
import { VendedorDashboard } from './VendedorDashboard'

describe('VendedorDashboard', () => {
  it('muestra la cantidad de pedidos', () => {
    render(<VendedorDashboard stats={{ cantidadPedidos: 7 }} period="week" />)
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('Pedidos')).toBeInTheDocument()
  })

  it('no muestra ningún monto en $ — la vendedora no ve facturación', () => {
    render(<VendedorDashboard stats={{ cantidadPedidos: 7 }} period="week" />)
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 14: Ejecutar — debe fallar.** Run: `pnpm test src/components/dashboard/VendedorDashboard.test.tsx` → FAIL.

- [ ] **Step 15: Implementar `src/components/dashboard/VendedorDashboard.tsx`**

```tsx
import type { VendedorDashboardStats } from '@/server/queries/dashboard'
import type { Period } from '@/lib/period'
import { PeriodSelector } from './PeriodSelector'
import { StatCard } from './StatCard'
import { integer } from '@/lib/format'

export function VendedorDashboard({ stats, period }: { stats: VendedorDashboardStats; period: Period }) {
  return (
    <section>
      <h1 className="text-xl font-semibold mb-4">Inicio</h1>
      <PeriodSelector period={period} />
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Pedidos" value={integer(stats.cantidadPedidos)} />
      </div>
    </section>
  )
}
```

- [ ] **Step 16: Ejecutar — debe pasar.** Run: `pnpm test src/components/dashboard/VendedorDashboard.test.tsx` → PASS.

- [ ] **Step 17: Commit**

```bash
git add src/components/dashboard
git commit -m "feat: componentes de dashboard (selector de período, tarjetas, ADMIN y VENDEDOR)"
```

---

### Task 4: Página `/` y link del logo

**Files:**
- Modify: `src/app/(app)/page.tsx`
- Test: `src/app/(app)/page.test.tsx`
- Modify: `src/components/layout/Header.tsx`
- Test: `src/components/layout/Header.test.tsx`

**Interfaces:**
- Consumes: `requireUser` (`@/server/auth/guards`, ya existe); `getAdminDashboardStats`, `getVendedorDashboardStats` (Task 2); `AdminDashboard`, `VendedorDashboard` (Task 3); `Period` (Task 1).
- Produces: sin cambio de firma pública — `/` sigue sin recibir props externas más allá de las estándar de Next.js.

- [ ] **Step 1: Test que falla — `src/app/(app)/page.test.tsx`**

```tsx
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const redirect = vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`) })
vi.mock('next/navigation', () => ({ redirect: (url: string) => redirect(url) }))

const requireUser = vi.fn()
vi.mock('@/server/auth/guards', () => ({ requireUser: () => requireUser() }))

const getAdminDashboardStats = vi.fn()
const getVendedorDashboardStats = vi.fn()
vi.mock('@/server/queries/dashboard', () => ({
  getAdminDashboardStats: (...args: unknown[]) => getAdminDashboardStats(...args),
  getVendedorDashboardStats: (...args: unknown[]) => getVendedorDashboardStats(...args),
}))

vi.mock('@/components/dashboard/AdminDashboard', () => ({
  AdminDashboard: ({ period }: { period: string }) => <div>Admin dashboard ({period})</div>,
}))
vi.mock('@/components/dashboard/VendedorDashboard', () => ({
  VendedorDashboard: ({ period }: { period: string }) => <div>Vendedor dashboard ({period})</div>,
}))

import IndexPage from './page'

beforeEach(() => {
  redirect.mockClear()
  requireUser.mockReset()
  getAdminDashboardStats.mockReset()
  getVendedorDashboardStats.mockReset()
})

describe('IndexPage', () => {
  it('ADMIN ve el dashboard de admin', async () => {
    requireUser.mockResolvedValue({ sub: 'u1', role: 'ADMIN', name: 'Ana', mustChangePassword: false })
    getAdminDashboardStats.mockResolvedValue({ totalFacturado: 0, cantidadVentas: 0, clientesNuevos: 0, ventasAnuladas: 0, stockBajo: [] })
    const jsx = await IndexPage({ searchParams: Promise.resolve({}) })
    render(jsx)
    expect(screen.getByText('Admin dashboard (day)')).toBeInTheDocument()
  })

  it('VENDEDOR ve el dashboard de vendedor, con su propio userId y el período de la URL', async () => {
    requireUser.mockResolvedValue({ sub: 'u2', role: 'VENDEDOR', name: 'Bruno', mustChangePassword: false })
    getVendedorDashboardStats.mockResolvedValue({ cantidadPedidos: 0 })
    const jsx = await IndexPage({ searchParams: Promise.resolve({ period: 'week' }) })
    render(jsx)
    expect(screen.getByText('Vendedor dashboard (week)')).toBeInTheDocument()
    expect(getVendedorDashboardStats).toHaveBeenCalledWith('u2', 'week')
  })

  it('DEPOSITO es redirigido a /productos', async () => {
    requireUser.mockResolvedValue({ sub: 'u3', role: 'DEPOSITO', name: 'Carla', mustChangePassword: false })
    await expect(IndexPage({ searchParams: Promise.resolve({}) })).rejects.toThrow('REDIRECT:/productos')
  })

  it('un valor de period inválido en la URL cae al default "day"', async () => {
    requireUser.mockResolvedValue({ sub: 'u1', role: 'ADMIN', name: 'Ana', mustChangePassword: false })
    getAdminDashboardStats.mockResolvedValue({ totalFacturado: 0, cantidadVentas: 0, clientesNuevos: 0, ventasAnuladas: 0, stockBajo: [] })
    const jsx = await IndexPage({ searchParams: Promise.resolve({ period: 'bogus' }) })
    render(jsx)
    expect(screen.getByText('Admin dashboard (day)')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Ejecutar — debe fallar.** Run: `pnpm test src/app/\(app\)/page.test.tsx` → FAIL (la página actual solo redirige a `/productos`).

- [ ] **Step 3: Implementar `src/app/(app)/page.tsx`**

Reemplazar todo el archivo:

```tsx
import { redirect } from 'next/navigation'
import { requireUser } from '@/server/auth/guards'
import { getAdminDashboardStats, getVendedorDashboardStats } from '@/server/queries/dashboard'
import type { Period } from '@/lib/period'
import { AdminDashboard } from '@/components/dashboard/AdminDashboard'
import { VendedorDashboard } from '@/components/dashboard/VendedorDashboard'

export default async function IndexPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const session = await requireUser()
  if (session.role === 'DEPOSITO') redirect('/productos')

  const sp = await searchParams
  const period: Period = sp.period === 'week' || sp.period === 'month' ? sp.period : 'day'

  if (session.role === 'ADMIN') {
    const stats = await getAdminDashboardStats(period)
    return <AdminDashboard stats={stats} period={period} />
  }

  const stats = await getVendedorDashboardStats(session.sub, period)
  return <VendedorDashboard stats={stats} period={period} />
}
```

- [ ] **Step 4: Ejecutar — debe pasar.** Run: `pnpm test src/app/\(app\)/page.test.tsx` → PASS (4 tests).

- [ ] **Step 5: Test que falla — `src/components/layout/Header.test.tsx`**

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({ usePathname: () => '/ventas' }))
import { Header } from './Header'

describe('Header', () => {
  it('el logo es un link a "/"', () => {
    render(<Header userName="Ana" role="ADMIN" />)
    const logo = screen.getByAltText('Jael Castillo — Todo para tu Hogar')
    expect(logo.closest('a')).toHaveAttribute('href', '/')
  })
})
```

- [ ] **Step 6: Ejecutar — debe fallar.** Run: `pnpm test src/components/layout/Header.test.tsx` → FAIL (el logo no está envuelto en un link todavía).

- [ ] **Step 7: Editar `src/components/layout/Header.tsx`**

Cambiar:

```tsx
import Image from 'next/image'
import { signOut } from '@/server/actions/auth'
import type { RoleName } from '@/lib/constants'
import { NavDrawer } from './NavDrawer'

export function Header({ userName, role }: { userName: string; role: RoleName }) {
  return (
    <header
      className="h-14 border-b border-border flex items-center gap-3 px-4 sticky top-0 bg-background z-20 print:hidden"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <NavDrawer role={role} />
      <Image src="/logo.png" alt="Jael Castillo — Todo para tu Hogar" width={36} height={36} className="rounded-full shrink-0" priority />
```

a:

```tsx
import Image from 'next/image'
import Link from 'next/link'
import { signOut } from '@/server/actions/auth'
import type { RoleName } from '@/lib/constants'
import { NavDrawer } from './NavDrawer'

export function Header({ userName, role }: { userName: string; role: RoleName }) {
  return (
    <header
      className="h-14 border-b border-border flex items-center gap-3 px-4 sticky top-0 bg-background z-20 print:hidden"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <NavDrawer role={role} />
      <Link href="/">
        <Image src="/logo.png" alt="Jael Castillo — Todo para tu Hogar" width={36} height={36} className="rounded-full shrink-0" priority />
      </Link>
```

(el resto del archivo, desde el `<div className="ml-auto...">` en adelante, queda exactamente igual.)

- [ ] **Step 8: Ejecutar — debe pasar.** Run: `pnpm test src/components/layout/Header.test.tsx` → PASS.

- [ ] **Step 9: Verificar la suite completa y el build**

```bash
pnpm test
pnpm exec tsc --noEmit
pnpm exec eslint .
pnpm build
```

- [ ] **Step 10: Commit**

```bash
git add "src/app/(app)/page.tsx" "src/app/(app)/page.test.tsx" src/components/layout/Header.tsx src/components/layout/Header.test.tsx
git commit -m "feat: / muestra el dashboard según el rol (ADMIN/VENDEDOR), logo enlaza a inicio"
```
