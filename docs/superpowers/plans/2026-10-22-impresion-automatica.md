# Impresión automática en el local Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que cada venta confirmada y cada presupuesto generado se impriman solos en la impresora A4 del local, sin importar desde qué dispositivo se carguen.

**Architecture:** Una tabla `PrintJob` funciona como cola. `createSale` y una acción nueva de presupuesto encolan trabajos; una pantalla `/impresion` (PC del local, Chrome con `--kiosk-printing`) consulta cada 5 s dos endpoints protegidos por una clave de estación, imprime cada comprobante una sola vez y lo marca como impreso. Los documentos de comprobante se extraen a componentes puros que reutilizan tanto las pantallas actuales como la estación.

**Tech Stack:** Next.js 16 (Route Handlers, Server Actions), Prisma 7 (migración), vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-22-impresion-automatica-design.md`

## Global Constraints

- Tipos de trabajo: `VENTA` y `PRESUPUESTO`. Las anulaciones no se imprimen.
- Presupuestos y trabajos se conservan 7 días; al encolar se borran los de más de 7 días.
- `pendientes` devuelve trabajos sin imprimir creados en las últimas 12 horas, del más viejo al más nuevo, máximo 10.
- Revisión de la estación cada 5 segundos, sin superponer revisiones.
- Autenticación de la estación: header `x-print-key` igual a `PRINT_STATION_KEY`, comparación en tiempo constante; sin clave configurada o incorrecta → 401. Sin sesión de usuario.
- `/impresion` y `/api/impresion` se agregan a `PUBLIC_PATHS` de `src/proxy.ts`.
- Papel A4: `@page { size: A4; margin: 0 }` con padding interno en el comprobante.
- Los precios del presupuesto se toman de la base con `effectivePrice` (`@/lib/pricing`), nunca del navegador; una línea sin precio no se encola.
- Textos de UI en español rioplatense. Los celulares y tablets conservan el botón "Imprimir" manual pero dejan de imprimir solos.
- La migración se aplica a la base real de Neon solo con confirmación explícita del usuario.

## Review Focus

- `PRINT_STATION_KEY` sin configurar no debe dejar los endpoints abiertos: responden 401 siempre. (Task 4)
- Una clave de largo distinto a la configurada no debe provocar un error 500 (`timingSafeEqual` lanza con largos distintos): responde 401. (Task 4)
- Una venta que falla por falta de stock no debe dejar un trabajo de impresión huérfano. (Task 2)
- Un presupuesto con precios alterados desde el navegador debe imprimirse con los precios de la base. (Task 3)
- Si una revisión de 5 s tarda más que el intervalo, no se lanza otra encima ni se imprime dos veces el mismo trabajo. (Task 6)
- Una venta anulada antes de imprimirse se imprime con la leyenda "Venta anulada". (Task 5)

---

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `prisma/schema.prisma` + nueva migración | Modelo `PrintJob` y enum `PrintJobKind` |
| `src/server/printing/queue.ts` | Encolar ventas y presupuestos, limpiar viejos |
| `src/server/printing/station.ts` | Autenticar la clave, listar pendientes, marcar impreso |
| `src/server/actions/quotes.ts` | Acción `enqueueQuote` |
| `src/app/api/impresion/pendientes/route.ts`, `marcar/route.ts` | Endpoints de la estación |
| `src/components/ventas/SaleDocument.tsx`, `QuoteDocument.tsx` | Comprobantes puros (sin botones ni `window.print`) |
| `src/components/impresion/PrintStation.tsx` | Cliente de la estación |
| `src/app/impresion/page.tsx`, `layout.tsx` | Página pública fuera del layout autenticado |

---

### Task 1: Modelo `PrintJob` y cola

**Files:**
- Modify: `prisma/schema.prisma`
- Create: nueva carpeta en `prisma/migrations/` (generada), `src/server/printing/queue.ts`
- Test: `src/server/printing/queue.test.ts` (con DB)
- Modify: `src/test/db.ts` (agregar `"PrintJob"` al `TRUNCATE`)

**Interfaces:**
- Produces:
  - `type QuotePayload = { lines: { productName: string; variantName: string; unitPrice: number; quantity: number }[]; total: number; customerName: string | null; issuedAt: string }`
  - `enqueueSalePrint(tx: Prisma.TransactionClient, saleId: string): Promise<void>`
  - `enqueueQuotePrint(payload: QuotePayload): Promise<void>`
  - `purgeOldPrintJobs(now?: Date): Promise<number>` (borra los de más de 7 días, devuelve la cantidad)

- [ ] **Step 1: Write the failing tests:** `enqueueSalePrint` crea un trabajo `VENTA` con `saleId` y `printedAt` nulo; `enqueueQuotePrint` crea un `PRESUPUESTO` con el payload guardado tal cual; `purgeOldPrintJobs` borra un trabajo de hace 8 días y deja el de hace 6; encolar uno nuevo dispara la limpieza.
- [ ] **Step 2: Run** `pnpm exec vitest run src/server/printing/queue.test.ts` → FAIL.
- [ ] **Step 3: Implement** el modelo `PrintJob` (campos del spec, `@@index([printedAt, createdAt])`, `saleId` con `onDelete: Cascade`), generar la migración con `prisma migrate dev --create-only --name add_print_jobs` apuntando `DATABASE_URL` a la base de test de `.env.test` (el `.env` normal apunta a Neon: nunca correr `migrate dev` ahí), aplicarla con `pnpm test:db:migrate`, y las tres funciones.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: cola de impresión (PrintJob) con limpieza de trabajos viejos`

---

### Task 2: `createSale` encola la impresión

**Files:**
- Modify: `src/server/actions/sales.ts` (dentro de la transacción, después de crear la venta)
- Test: `src/server/actions/sales.test.ts`

**Interfaces:**
- Consumes: `enqueueSalePrint` (Task 1).

- [ ] **Step 1: Write the failing tests:** una venta exitosa deja exactamente un `PrintJob` `VENTA` con su `saleId`; una venta rechazada por stock insuficiente no deja ningún `PrintJob`.
- [ ] **Step 2: Run** `pnpm exec vitest run src/server/actions/sales.test.ts` → FAIL.
- [ ] **Step 3: Implement** la llamada a `enqueueSalePrint(tx, sale.id)` dentro de `prisma.$transaction` de `createSale`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: createSale encola el comprobante para imprimir`

---

### Task 3: Acción `enqueueQuote` y conexión en el carrito

**Files:**
- Create: `src/server/actions/quotes.ts`
- Modify: `src/components/ventas/SaleCart.tsx`
- Test: `src/server/actions/quotes.test.ts` (con DB), `src/components/ventas/SaleCart.test.tsx` (si existe, ampliarlo; si no, crearlo)

**Interfaces:**
- Consumes: `enqueueQuotePrint`, `QuotePayload` (Task 1); `effectivePrice`, `toNumber` de `@/lib/pricing`.
- Produces: `enqueueQuote(input: unknown): Promise<{ ok: true } | { ok: false; error: string }>` con `input = { items: { variantId: string; quantity: number }[]; customerName?: string }`. Requiere rol `ADMIN` o `VENDEDOR`.

- [ ] **Step 1: Write the failing tests:** (acción) el payload guardado usa los precios de la base aunque el input traiga otros; una variante sin precio efectivo devuelve `{ ok: false, error: '<producto> · <variante> no tiene precio cargado' }` y no encola; cantidad 0 o negativa → error; rol DEPOSITO rechazado. (Carrito) al presionar "Generar presupuesto" se llama a `enqueueQuote` con las líneas y recién después se muestra el comprobante; si la acción devuelve error se muestra el mensaje y no se muestra el comprobante.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** la acción con zod (mismas reglas de cantidad que `createSaleSchema`) y cambiar el botón de presupuesto de `SaleCart` para llamarla con estado `pending`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: los presupuestos se encolan para imprimir con precios de la base`

---

### Task 4: Autenticación de la estación y endpoints

**Files:**
- Create: `src/server/printing/station.ts`, `src/app/api/impresion/pendientes/route.ts`, `src/app/api/impresion/marcar/route.ts`
- Modify: `src/proxy.ts` (`PUBLIC_PATHS`), `.env.example` (`PRINT_STATION_KEY`)
- Test: `src/server/printing/station.test.ts` (con DB), `src/app/api/impresion/impresion.test.ts`

**Interfaces:**
- Consumes: `getSale` de `@/server/queries/sales`; `QuotePayload` (Task 1).
- Produces:
  - `isValidStationKey(provided: string | null): boolean`
  - `type PrintableJob = { id: string; kind: 'VENTA'; sale: SaleDetail } | { id: string; kind: 'PRESUPUESTO'; quote: QuotePayload }`
  - `listPendingJobs(now?: Date): Promise<PrintableJob[]>`
  - `markJobPrinted(id: string): Promise<void>` (idempotente)
  - `GET /api/impresion/pendientes` → `{ jobs: PrintableJob[] }`; `POST /api/impresion/marcar` con `{ id }` → `{ ok: true }`. Ambos 401 sin clave válida.

- [ ] **Step 1: Write the failing tests:** `isValidStationKey` falso cuando `PRINT_STATION_KEY` no está definida o está vacía (aunque se envíe vacío), falso con clave de largo distinto, verdadero con la correcta; `listPendingJobs` excluye impresos y los de más de 12 horas, respeta el orden y el máximo de 10, e incluye la venta con `cancelledAt` si fue anulada; `markJobPrinted` dos veces deja el mismo `printedAt`; los endpoints responden 401 sin header o con clave incorrecta y 200 con la correcta.
- [ ] **Step 2: Run** `pnpm exec vitest run src/server/printing src/app/api/impresion` → FAIL.
- [ ] **Step 3: Implement** con `crypto.timingSafeEqual` comparando buffers del mismo largo (verificar largo antes). Agregar `'/impresion'` y `'/api/impresion'` a `PUBLIC_PATHS`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: endpoints de la estación de impresión con clave propia`

---

### Task 5: Extraer los comprobantes y quitar la impresión local

**Files:**
- Create: `src/components/ventas/SaleDocument.tsx`, `src/components/ventas/QuoteDocument.tsx`
- Modify: `src/components/ventas/SaleReceipt.tsx`, `src/components/ventas/QuoteReceipt.tsx`
- Test: `src/components/ventas/SaleDocument.test.tsx`, `QuoteDocument.test.tsx`; actualizar los tests existentes de `QuoteReceipt` y de `SaleReceipt` si los hay

**Interfaces:**
- Produces:
  - `SaleDocument({ sale }: { sale: Omit<SaleDetail, 'createdAt' | 'cancelledAt'> & { createdAt: Date | string; cancelledAt: Date | string | null } })`
  - `QuoteDocument({ quote }: { quote: QuotePayload })` (con `unitPrice: number | null` aceptado en líneas para el uso desde el carrito)

- [ ] **Step 1: Write the failing tests:** `SaleDocument` muestra número de ticket, vendedora, líneas, total, método de pago y, si `cancelledAt` tiene valor, "Venta anulada"; acepta fechas como string ISO. `QuoteDocument` muestra cliente (si existe), líneas, total y la leyenda "Presupuesto sin cargo". `SaleReceipt` con `?justCreated=1` ya **no** llama a `window.print`; `QuoteReceipt` no llama a `window.print` al montarse; el botón "Imprimir" manual sigue llamándolo.
- [ ] **Step 2: Run** `pnpm exec vitest run src/components/ventas` → FAIL.
- [ ] **Step 3: Implement** moviendo el bloque del comprobante a los componentes nuevos (sin botones ni `window.print`), usarlos desde `SaleReceipt`/`QuoteReceipt` y eliminar el `useEffect` de impresión automática y el `router.replace` asociado a `justCreated` cuando ya no se necesite.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `refactor: comprobantes como documentos puros y sin impresión automática local`

---

### Task 6: Pantalla de la estación

**Files:**
- Create: `src/app/impresion/layout.tsx`, `src/app/impresion/page.tsx`, `src/components/impresion/PrintStation.tsx`
- Test: `src/components/impresion/PrintStation.test.tsx`

**Interfaces:**
- Consumes: `PrintableJob` (Task 4), `SaleDocument` y `QuoteDocument` (Task 5).
- Produces: `<PrintStation clave={string} />` (client). La página lee `searchParams.clave` y, si falta, muestra el aviso "Falta la clave de la estación".

- [ ] **Step 1: Write the failing tests** (con `fetch`, `window.print` y temporizadores simulados): una revisión con 2 trabajos imprime los dos en orden y llama a `marcar` por cada uno solo después de imprimirlo; el mismo trabajo devuelto en una segunda revisión no se imprime otra vez; si `window.print` lanza, no se marca como impreso; una revisión lenta (fetch pendiente) no dispara una segunda revisión al cumplirse los 5 s; un 401 muestra "Clave incorrecta" y un error de red muestra el aviso rojo de conexión; sin trabajos se muestra "Conectada · última revisión hh:mm:ss".
- [ ] **Step 2: Run** `pnpm exec vitest run src/components/impresion` → FAIL.
- [ ] **Step 3: Implement** con un `setTimeout` recursivo (no `setInterval`) para no superponer, un `Set` en `useRef` con los ids ya impresos, el estilo `@media print { @page { size: A4; margin: 0 } }` y el comprobante visible solo al imprimir. El layout propio evita el menú, el header y el login.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: pantalla /impresion que imprime la cola automáticamente`

---

### Task 7: Documentación, entorno y verificación final

**Files:**
- Modify: `README.md` (sección "Estación de impresión del local")

- [ ] **Step 1:** Documentar en el README los 4 pasos de instalación del spec y el aviso de "una sola estación abierta".
- [ ] **Step 2:** `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build` sin errores y `pnpm test` completo en verde (con `pnpm test:db:up`).
- [ ] **Step 3:** Pedir confirmación al usuario y recién entonces aplicar la migración a Neon con `pnpm db:deploy`.
- [ ] **Step 4:** Cargar `PRINT_STATION_KEY` (una clave larga aleatoria) en `.env` y en Netlify.
- [ ] **Step 5:** Prueba real: abrir la estación en la PC del local, hacer una venta y un presupuesto desde un celular y verificar que salen impresos una sola vez.
- [ ] **Step 6: Commit** `docs: instalación de la estación de impresión`
