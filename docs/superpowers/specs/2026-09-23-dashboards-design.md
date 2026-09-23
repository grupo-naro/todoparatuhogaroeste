# Dashboards por rol (ADMIN / VENDEDOR)

## Contexto y objetivo

Hoy la app no tiene una pantalla de inicio real: `/` redirige sin
condiciones a `/productos` (`src/app/(app)/page.tsx`), lo cual además está
roto para VENDEDOR — no tiene acceso a `/productos` y queda rebotando.

Se necesita que cada rol, al entrar, vea un panel con las novedades que le
importan a ESE rol, con selector de período (día/semana/mes):

- **ADMIN**: números de todo el negocio (facturación, ventas, clientes
  nuevos, anulaciones) más una alerta de stock bajo.
- **VENDEDOR**: solo la cantidad de pedidos (ventas) que hizo, sin montos.
- **DEPOSITO**: sin dashboard en esta iteración — sigue yendo a
  `/productos` como hoy. Puede agregarse después como iteración aparte.

## Alcance

### Dentro de alcance

1. `/` deja de redirigir siempre a `/productos`: ahora renderiza el
   dashboard del rol logueado (ADMIN o VENDEDOR), o redirige a
   `/productos` si el rol es DEPOSITO (comportamiento actual, preservado
   solo para ese rol).
2. Selector de período (Hoy / Semana / Mes) vía query param en la URL
   (`?period=day|week|month`, default `day`), mismo patrón ya usado en
   `/deposito` (`StockFilters` + `searchParams`).
3. Dashboard ADMIN: 4 métricas numéricas para el período elegido (total
   facturado, cantidad de ventas, clientes nuevos, ventas anuladas) más
   una lista de alerta de stock bajo (no depende del período — es una foto
   del estado actual).
4. Dashboard VENDEDOR: 1 métrica (cantidad de pedidos hechos en el
   período por esa persona).
5. El logo del header pasa a ser un link a `/` (hoy no lo es) — necesario
   porque `/` ahora es un destino con contenido propio, no solo un
   redirect.

### Fuera de alcance (esta iteración)

Dashboard para DEPOSITO, stock mínimo configurable por producto (se usa
un umbral fijo), gráficos/series históricas (todo son números puntuales
del período, sin visualización de tendencia), exportar/imprimir el
dashboard, comparar un período contra el anterior ("vs. semana pasada"),
ranking entre vendedoras, dashboard con las estadísticas de un vendedor
visto por el ADMIN (el ADMIN ve el negocio agregado, no el desglose por
persona), refrescar en tiempo real (los datos se recalculan al cargar la
página o cambiar de período, no hay polling ni websockets).

## Arquitectura

### Cálculo de períodos — `src/lib/period.ts` (nuevo)

Argentina tiene offset fijo UTC−3 sin horario de verano desde 2009 — no
hace falta ninguna librería de timezones, pero sí hay que evitar el bug
ya conocido en este proyecto (`formatDate` mostraba UTC en vez de hora
argentina hasta que se corrigió explícitamente). Los límites de período
se calculan restando 3 horas al instante UTC actual para "entrar" al día
argentino, truncando ahí, y sumando 3 horas de vuelta para obtener los
instantes UTC correctos a usar en las queries de Prisma.

```ts
export type Period = 'day' | 'week' | 'month'

const AR_OFFSET_MS = 3 * 60 * 60 * 1000 // Argentina = UTC-3, sin DST

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

`from` se trunca en el "frame" argentino (restando el offset) y después
se le suma el offset de vuelta para obtener el instante UTC exacto que
corresponde a esa medianoche argentina. `to` es siempre `now` — el
período va desde `from` hasta el momento actual, no hasta el final
del día/semana/mes.

### Queries — `src/server/queries/dashboard.ts` (nuevo)

```ts
export type AdminDashboardStats = {
  totalFacturado: number
  cantidadVentas: number
  clientesNuevos: number
  ventasAnuladas: number
  stockBajo: { variantId: string; productName: string; variantName: string; quantity: number }[]
}
export async function getAdminDashboardStats(period: Period): Promise<AdminDashboardStats>

export type VendedorDashboardStats = { cantidadPedidos: number }
export async function getVendedorDashboardStats(userId: string, period: Period): Promise<VendedorDashboardStats>
```

`getAdminDashboardStats`:
- `totalFacturado`/`cantidadVentas`: misma condición `where: { cancelledAt: null, createdAt: { gte: from, lte: to } }` para ambas. `cantidadVentas = prisma.sale.count({ where })` (mismo patrón que ya usa el resto del proyecto — `customer.count` en `customers.ts`, nunca `.aggregate({ _count: true })`, que este código base no usa en ningún lado). `totalFacturado`: `prisma.sale.aggregate({ where, _sum: { total: true } })`, después `toNumber(_sum.total) ?? 0` (nunca un `Decimal` crudo, mismo criterio que `customers.ts`).
- `clientesNuevos`: `prisma.customer.count({ where: { createdAt: { gte: from, lte: to } } })`.
- `ventasAnuladas`: `prisma.sale.count({ where: { cancelledAt: { gte: from, lte: to } } })` — cuenta por cuándo se anuló, no por cuándo se creó la venta original (una venta anulada esta semana pero creada el mes pasado cuenta como anulación de esta semana).
- `stockBajo`: **no depende del período.** `prisma.productVariant.findMany({ where: { stock: { quantity: { lte: 3 } } }, include: { stock: true, product: { select: { name: true } } }, orderBy: { stock: { quantity: 'asc' } }, take: 5 })`, mapeado a `{ variantId: v.id, productName: v.product.name, variantName: v.name, quantity: v.stock?.quantity ?? 0 }`. El umbral `3` es una constante exportada (`LOW_STOCK_THRESHOLD = 3`) para no repetir el número mágico.

`getVendedorDashboardStats`:
- `cantidadPedidos`: `prisma.sale.count({ where: { userId, cancelledAt: null, createdAt: { gte: from, lte: to } } })`.

### Página — `src/app/(app)/page.tsx` (reescrita)

```tsx
import { redirect } from 'next/navigation'
import { requireUser } from '@/server/auth/guards'
import { getAdminDashboardStats, getVendedorDashboardStats } from '@/server/queries/dashboard'
import { getPeriodRange, type Period } from '@/lib/period'
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

`requireUser()` (no `requireRole`) porque cualquier rol autenticado tiene
que poder entrar a `/` — el branching de qué ver pasa adentro, no en el
guard. Confirmado en `src/server/auth/guards.ts:6` — devuelve
`SessionPayload` (`src/server/auth/session.ts:9`), con `sub` (id de
usuario) y `role` exactamente como se usan arriba.

### Componentes — `src/components/dashboard/` (nuevo)

- `PeriodSelector.tsx` (`'use client'`): tres botones (Hoy/Semana/Mes),
  mismo patrón de `useRouter`/`useSearchParams`/`usePathname` que
  `StockFilters.tsx` — al hacer click, hace `router.push` con
  `?period=...` preservando otros params si los hubiera (no hay otros acá,
  pero seguir el mismo criterio de no pisar el resto de la URL).
- `StatCard.tsx`: `{ label: string; value: string }` — una tarjeta simple
  con label y valor grande, reutilizada por ambos dashboards
  (`money(n)`/`integer(n)` se formatean antes de pasarlos como `value`).
- `AdminDashboard.tsx`: recibe `stats: AdminDashboardStats` y `period:
  Period`. Renderiza `<PeriodSelector>` + 4 `<StatCard>` + la lista de
  stock bajo (si `stats.stockBajo.length === 0`, mensaje "Todo con
  stock").
- `VendedorDashboard.tsx`: recibe `stats: VendedorDashboardStats` y
  `period: Period`. Renderiza `<PeriodSelector>` + 1 `<StatCard>`.

### Header — `src/components/layout/Header.tsx`

El `<Image src="/logo.png" ...>` (línea 12) se envuelve en `<Link
href="/">`.

## Manejo de errores / casos límite

| Caso | Comportamiento |
|---|---|
| VENDEDOR sin ventas en el período | `cantidadPedidos: 0`, se muestra "0" sin error |
| ADMIN sin ninguna venta/cliente nuevo en el período | Todas las tarjetas en 0 |
| Ningún producto con stock bajo | Mensaje "Todo con stock" en vez de lista vacía |
| `period` en la URL con un valor inválido (ni day/week/month) | Se trata como `day` (default), sin error 400 |
| DEPOSITO entra a `/` | Redirect a `/productos`, igual que hoy |

## Testing

Sigue las convenciones ya establecidas del proyecto (queries/acciones
contra la base de test de Docker; componentes con RTL; funciones puras
con tests unitarios directos):

- `src/lib/period.test.ts`: el foco de mayor riesgo de todo este trabajo.
  Con un `now` fijo inyectado (no `Date.now()` real), verificar los
  límites exactos de `from` para `day`/`week`/`month`, incluyendo casos
  borde: medianoche justo en Argentina, un `now` un minuto antes/después
  de medianoche argentina (para confirmar que no se corre un día por el
  offset UTC del servidor), una semana que cruza fin de mes, un `now` en
  domingo (debe ir al lunes anterior, no al lunes siguiente).
- `src/server/queries/dashboard.test.ts`: `getAdminDashboardStats`
  (ventas ancladas excluyen anuladas del total/cantidad, clientes nuevos
  cuenta por `createdAt`, ventas anuladas cuenta por `cancelledAt` no por
  `createdAt` de la venta original, stock bajo respeta el umbral y el
  orden ascendente, y no depende del período elegido); 
  `getVendedorDashboardStats` (solo cuenta ventas de `userId`, excluye
  anuladas, excluye ventas de otra vendedora).
- Componentes: `AdminDashboard`/`VendedorDashboard` con stats mockeadas
  (RTL, cada número se ve donde corresponde); `PeriodSelector` (click en
  cada botón empuja el `?period=` correcto a la URL).
- `page.tsx`: test de que ADMIN ve `AdminDashboard`, VENDEDOR ve
  `VendedorDashboard`, DEPOSITO es redirigido a `/productos`.
- `Header.tsx`: test de que el logo ahora es un link a `/`.
