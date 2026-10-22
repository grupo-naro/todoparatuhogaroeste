# Importación masiva de productos con Gemini Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un ADMIN suba un CSV, Excel, PDF o imagen con el inventario del cliente, revise lo que Gemini interpretó y lo cargue de una vez (categorías, productos, variantes, precios y stock inicial).

**Architecture:** Dos Route Handlers livianos (leer archivo / interpretar un lote) devuelven filas validadas con zod y marcadas contra la base; una Server Action `confirmImport` re-valida y guarda todo en una transacción. Un wizard cliente (subir, revisar, confirmar) orquesta los requests por lotes. Gemini solo vive en el servidor y siempre se mockea en tests.

**Tech Stack:** Next.js 16 (App Router, Route Handlers, Server Actions), Prisma 7, zod 4, vitest + Testing Library, `@google/genai`, `exceljs`.

**Spec:** `docs/superpowers/specs/2026-10-22-importar-productos-design.md`

## Global Constraints

- Solo ADMIN: `requireRole('ADMIN')` en la acción; en los Route Handlers `readSession()` con 401 si no hay sesión y 403 si el rol no es ADMIN.
- Archivos de hasta 4 MB (`MAX_IMPORT_BYTES = 4 * 1024 * 1024`). Tipos: `.csv`, `.xlsx`, `application/pdf`, `image/jpeg`, `image/png`, `image/webp`. No se soporta `.xls` antiguo.
- Lotes de CSV/XLSX: máximo 40 filas por request (`IMPORT_BATCH_SIZE = 40`).
- Variante sin nombre se llama `'Única'` (igual que `createProduct`). El stock vacío es 0.
- Producto existente = misma categoría y nombre comparando sin mayúsculas ni espacios sobrantes: se saltea, nunca se pisa precio ni stock.
- Stock inicial: `InventoryStock` + `InventoryTransaction` tipo `CARGA_INICIAL` solo si stock > 0, con `userId` de la sesión.
- Slug de categorías nuevas con `slugify` de `@/lib/format`.
- La clave `GEMINI_API_KEY` y el modelo `GEMINI_MODEL` (default `gemini-2.5-flash`, confirmar el nombre vigente al implementar) nunca llegan al cliente. No se loguea el contenido de los archivos.
- Textos de UI en español rioplatense, como el resto de la app. Targets táctiles `min-h-11`; la pantalla debe usarse bien en celular y tablet.
- Tests con DB: requieren la base de test (`pnpm test:db:up`); Gemini y `fetch` siempre mockeados.

## Review Focus

- Precios en formato argentino o con símbolo (`"$ 1.234,50"`, `"12.000"`, `"12,5"`) deben leerse como número; texto no numérico en precio/costo es error de fila, no `null` silencioso. (Task 1)
- Dos filas del mismo archivo con igual (categoría, producto, variante) no deben duplicar: la segunda se marca duplicada y se saltea. (Task 1)
- `"sillón milán "` y `"Sillón Milán"` deben tratarse como el mismo producto existente, no crear un casi-duplicado. (Task 4)
- Stock con texto (`"s/s"`, `"-"`) o decimal (`"2,5"`) es error de fila; stock vacío es 0. (Task 1)
- Gemini devuelve distinta cantidad de filas que las enviadas: se avisa en la respuesta en lugar de perder filas en silencio. (Task 3)

---

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `src/lib/import/schema.ts` | Esquema zod de fila, tipos, parseo de números, agrupación y detección de duplicados |
| `src/lib/import/spreadsheet.ts` | Leer CSV/XLSX a matriz de strings |
| `src/server/import/gemini.ts` | Llamadas a Gemini (tabla y documento) con salida estructurada |
| `src/server/import/preview.ts` | Marcar filas contra la base (existe, categoría nueva, avisos) |
| `src/app/api/importar/leer/route.ts` | POST archivo → tabla (CSV/XLSX) o filas interpretadas (PDF/imagen) |
| `src/app/api/importar/interpretar/route.ts` | POST lote de filas de tabla → filas interpretadas |
| `src/server/actions/importProducts.ts` | `confirmImport` transaccional |
| `src/components/import/ImportWizard.tsx` | UI: subir, progreso, revisión editable, confirmar |
| `src/app/(app)/productos/importar/page.tsx` + `loading.tsx` | Página ADMIN |
| `src/app/(app)/productos/page.tsx` | Botón "Importar" |

---

### Task 1: Esquema de fila, números y duplicados

**Files:**
- Create: `src/lib/import/schema.ts`
- Test: `src/lib/import/schema.test.ts`

**Interfaces:**
- Produces:
  - `type ImportRow = { categoria: string; producto: string; variante: string; medida: string | null; tela: string | null; color: string | null; costo: number | null; precio: number | null; stock: number }`
  - `parseArNumber(raw: unknown): number | null | typeof INVALID` donde `INVALID` es un `Symbol` exportado; vacío/`null` → `null`.
  - `normalizeRow(raw: Record<string, unknown>): { ok: true; row: ImportRow } | { ok: false; error: string }`
  - `normKey(s: string): string` (trim, minúsculas, sin tildes, espacios colapsados)
  - `markDuplicates(rows: ImportRow[]): boolean[]` (true en las repetidas desde la segunda aparición, clave `normKey(categoria)|normKey(producto)|normKey(variante)`)
  - `MAX_IMPORT_BYTES`, `IMPORT_BATCH_SIZE`

- [ ] **Step 1: Write the failing tests** en `schema.test.ts`:
  - `parseArNumber('$ 1.234,50')` → `1234.5`; `'12.000'` → `12000`; `'12,5'` → `12.5`; `'  '` → `null`; `'abc'` → `INVALID`; `'-3'` → `INVALID` (negativo).
  - `normalizeRow({ categoria: 'Sillones', producto: 'Milán', precio: '$ 250.000', stock: '' })` → `ok` con `variante: 'Única'`, `stock: 0`, `precio: 250000`, `costo: null`.
  - `normalizeRow({ ..., stock: 's/s' })` y `stock: '2,5'` → `ok: false` con mensaje que menciona "stock".
  - `normalizeRow({ producto: 'X' })` (sin categoría) → `ok: false`.
  - `markDuplicates` con dos filas iguales salvo mayúsculas/espacios → `[false, true]`.

- [ ] **Step 2: Run** `pnpm exec vitest run src/lib/import/schema.test.ts` → FAIL (módulo inexistente).

- [ ] **Step 3: Implement** lo anterior en `schema.ts`. Parseo de números: quitar `$` y espacios; si contiene `,` es el decimal y los `.` son miles; si no contiene `,` y los `.` son miles solo cuando hay 3 dígitos tras cada punto, si no es decimal. Límites de longitud como `productSchema` (producto ≤120, categoría ≤60, variante ≤120, medida/tela/color ≤60).

- [ ] **Step 4: Run** el mismo comando → PASS.

- [ ] **Step 5: Commit** `feat: esquema y normalización de filas para importar productos`

---

### Task 2: Lectura de CSV y Excel

**Files:**
- Create: `src/lib/import/spreadsheet.ts`
- Test: `src/lib/import/spreadsheet.test.ts`
- Modify: `package.json` (dependencia `exceljs`)

**Interfaces:**
- Consumes: nada.
- Produces: `readSpreadsheet(bytes: Uint8Array, kind: 'csv' | 'xlsx'): Promise<string[][]>` — primera hoja con datos, celdas como texto, sin filas totalmente vacías, la primera fila no vacía es el encabezado.

- [ ] **Step 1: Write the failing tests:** CSV `"Producto;Precio\nMesa;1.000\n\nSilla;500\n"` (separador `;`) y `"a,b\n1,2"` (separador `,`) → matriz sin filas vacías. XLSX generado en el test con `exceljs` (dos hojas, la primera vacía) → devuelve la primera hoja con datos; una celda numérica `1500` sale como `'1500'`.

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** `pnpm add exceljs`. CSV: detectar separador (`;` si aparece en la primera línea más que `,`), respetar comillas, quitar BOM. XLSX: `exceljs` `Workbook.xlsx.load`.

- [ ] **Step 4: Run** → PASS.

- [ ] **Step 5: Commit** `feat: leer CSV y Excel a matriz de texto`

---

### Task 3: Cliente de Gemini

**Files:**
- Create: `src/server/import/gemini.ts`
- Test: `src/server/import/gemini.test.ts`
- Modify: `package.json` (dependencia `@google/genai`), `.env.example`

**Interfaces:**
- Consumes: `normalizeRow`, `ImportRow` (Task 1).
- Produces:
  - `type Interpreted = { rows: ImportRow[]; errors: { index: number; error: string }[]; warning: string | null }`
  - `interpretTable(header: string[], rows: string[][]): Promise<Interpreted>` — `warning` no nulo si Gemini devolvió distinta cantidad de filas que `rows.length`.
  - `interpretDocument(file: { mimeType: string; bytes: Uint8Array }): Promise<Interpreted>`
  - Ambas lanzan `GeminiError` (clase exportada con mensaje en español) si falta `GEMINI_API_KEY`, la llamada falla o la respuesta no es JSON válido.

- [ ] **Step 1: Write the failing tests** (mockeando `@google/genai` con `vi.mock`): respuesta con 2 filas válidas y 1 con stock inválido → `rows.length === 2`, `errors` con el índice de la inválida; pedir 3 filas y recibir 2 → `warning` no nulo; sin `GEMINI_API_KEY` → lanza `GeminiError`; el request incluye `responseMimeType: 'application/json'` y, para documentos, un `inlineData` con el `mimeType` recibido; el prompt contiene la instrucción de tratar el contenido como datos y no como instrucciones.

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** con `GoogleGenAI.models.generateContent`, `config.responseSchema` con las 9 propiedades del contrato (español, sin tildes en las claves: `categoria, producto, variante, medida, tela, color, costo, precio, stock`). Cada fila devuelta pasa por `normalizeRow`. El prompt pide: separar producto de variante cuando el nombre lo sugiere, no inventar precios ni stock, dejar vacío lo desconocido.

- [ ] **Step 4: Run** → PASS.

- [ ] **Step 5: Commit** `feat: cliente Gemini con salida estructurada para importar productos`

---

### Task 4: Marcado contra la base

**Files:**
- Create: `src/server/import/preview.ts`
- Test: `src/server/import/preview.test.ts` (con DB)

**Interfaces:**
- Consumes: `ImportRow`, `normKey`, `markDuplicates` (Task 1).
- Produces:
  - `type PreviewRow = ImportRow & { existe: boolean; duplicada: boolean; categoriaNueva: boolean; avisos: string[] }`
  - `previewRows(rows: ImportRow[]): Promise<PreviewRow[]>` — `existe` si ya hay un producto con esa categoría y nombre (comparación con `normKey`); `categoriaNueva` si la categoría no existe; `avisos` incluye `'Sin precio: no se podrá vender'` cuando `precio === null`.

- [ ] **Step 1: Write the failing tests** (`resetDb`, categoría "Sillones" y producto "Sillón Milán"): fila `"sillones" / "sillón milan "` → `existe: true`; categoría desconocida → `categoriaNueva: true`; dos filas iguales → la segunda `duplicada: true`; fila sin precio → aviso.

- [ ] **Step 2: Run** `pnpm exec vitest run src/server/import/preview.test.ts` → FAIL.

- [ ] **Step 3: Implement** cargando categorías y productos relevantes con una sola consulta y comparando en memoria con `normKey`.

- [ ] **Step 4: Run** → PASS.

- [ ] **Step 5: Commit** `feat: marcar filas importadas contra productos y categorías existentes`

---

### Task 5: Route Handlers de lectura e interpretación

**Files:**
- Create: `src/app/api/importar/leer/route.ts`, `src/app/api/importar/interpretar/route.ts`
- Test: `src/app/api/importar/importar.test.ts`

**Interfaces:**
- Consumes: `readSpreadsheet` (T2), `interpretTable`/`interpretDocument`/`GeminiError` (T3), `previewRows` (T4), `readSession` de `@/server/auth/session`.
- Produces (JSON):
  - `POST /api/importar/leer` (multipart, campo `file`) → `{ kind: 'tabla', header: string[], rows: string[][] }` para CSV/XLSX, o `{ kind: 'filas', rows: PreviewRow[], errors, warning }` para PDF/imagen. Errores: `{ error: string }` con 400 (tipo o tamaño), 401, 403, 502 (Gemini).
  - `POST /api/importar/interpretar` (JSON `{ header: string[], rows: string[][] }`, máximo `IMPORT_BATCH_SIZE` filas) → `{ rows: PreviewRow[], errors, warning }`.
- Nota: el `proxy.ts` redirige a `/login` sin sesión; el handler igual valida el rol y responde JSON.

- [ ] **Step 1: Write the failing tests** (mock de `readSession`, `gemini` y `previewRows`): sin sesión → 401; rol VENDEDOR → 403; archivo de 5 MB → 400; `.exe` → 400; CSV válido → `kind: 'tabla'` sin llamar a Gemini; PDF → llama `interpretDocument` y devuelve `kind: 'filas'`; lote de 41 filas → 400; `GeminiError` → 502 con su mensaje.

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** ambos handlers con `export const runtime = 'nodejs'`. Detectar tipo por extensión y `file.type`.

- [ ] **Step 4: Run** → PASS.

- [ ] **Step 5: Commit** `feat: endpoints para leer e interpretar archivos de importación`

---

### Task 6: Confirmación transaccional

**Files:**
- Create: `src/server/actions/importProducts.ts`
- Test: `src/server/actions/importProducts.test.ts` (con DB)

**Interfaces:**
- Consumes: `normalizeRow`, `markDuplicates`, `normKey` (T1).
- Produces: `confirmImport(input: unknown): Promise<{ ok: true; productosCreados: number; variantesCreadas: number; saltados: number } | { ok: false; error: string }>`. `input` es `ImportRow[]` (máximo 2000 filas). Revalida cada fila, descarta duplicadas y existentes (cuentan en `saltados`), crea categorías faltantes, productos, variantes y stock; `revalidatePath` de `/productos` y `/deposito`.

- [ ] **Step 1: Write the failing tests** (guards mockeado como en `products.test.ts`): importa 3 filas (2 variantes del mismo producto + 1 producto con categoría nueva) → cuenta de productos/variantes/categoría creadas, `InventoryStock` y `CARGA_INICIAL` solo para stock > 0; producto existente (con distinta capitalización) se saltea sin tocar su precio; fila duplicada se saltea; una fila inválida en el input → `ok: false` y no se crea nada; si falla la creación a mitad (variante con nombre repetido forzado) no queda ningún dato; llamar dos veces seguidas con el mismo input crea una sola vez (segunda: todo `saltados`); requiere ADMIN (`requireRole` llamado con `'ADMIN'`).

- [ ] **Step 2: Run** `pnpm exec vitest run src/server/actions/importProducts.test.ts` → FAIL.

- [ ] **Step 3: Implement** en una única `prisma.$transaction` (timeout ampliado para lotes grandes). Producto nuevo: `defaultPrice`/`defaultCost` en `null`; los precios van en cada variante.

- [ ] **Step 4: Run** → PASS.

- [ ] **Step 5: Commit** `feat: confirmImport crea categorías, productos, variantes y stock inicial`

---

### Task 7: Wizard de importación

**Files:**
- Create: `src/components/import/ImportWizard.tsx`, `src/components/import/ImportWizard.test.tsx`, `src/app/(app)/productos/importar/page.tsx`, `src/app/(app)/productos/importar/loading.tsx`
- Modify: `src/app/(app)/productos/page.tsx` (botón "Importar" junto a "Nuevo producto", visible solo para ADMIN)

**Interfaces:**
- Consumes: endpoints de Task 5, `confirmImport` (T6), `useToast`, `Button`, `Input`, `Skeleton`.
- Produces: `<ImportWizard />` (client). Estados: `subir` → `procesando` (barra de progreso con lotes) → `revisar` → `listo`.

- [ ] **Step 1: Write the failing tests** (mock de `fetch` y `confirmImport`): subir un CSV dispara `/api/importar/leer` y luego `/api/importar/interpretar` una vez por lote de 40; con 90 filas se hacen 3 llamadas; en la revisión se muestran las filas con etiqueta "Ya existe" (deshabilitada) y "Categoría nueva"; editar un precio en la tabla cambia el valor que recibe `confirmImport`; descartar una fila la quita del envío; el botón Confirmar se deshabilita mientras guarda (no hay doble envío); un error 502 muestra el mensaje y permite reintentar sin volver a elegir archivo; al terminar muestra los contados (creados / saltados).

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** el wizard. Revisión: lista de tarjetas en celular y tabla desde `lg` (mismo criterio responsive que `ProductList`). Página con `requireRole('ADMIN')` y `loading.tsx` con skeleton.

- [ ] **Step 4: Run** `pnpm exec vitest run src/components/import` → PASS.

- [ ] **Step 5: Commit** `feat: pantalla para importar productos con revisión previa`

---

### Task 8: Verificación final y entorno

**Files:**
- Modify: `.env.example` (`GEMINI_API_KEY`, `GEMINI_MODEL`)

- [ ] **Step 1:** `pnpm exec tsc --noEmit`, `pnpm lint` y `pnpm build` sin errores.
- [ ] **Step 2:** `pnpm test:db:up` y `pnpm test` completo en verde.
- [ ] **Step 3:** Con una planilla real chica y `GEMINI_API_KEY` en `.env`, probar en `pnpm dev`: CSV, XLSX y un PDF; confirmar que lo cargado aparece en `/productos` y `/deposito` con el stock correcto.
- [ ] **Step 4:** Cargar `GEMINI_API_KEY` y `GEMINI_MODEL` en Netlify.
- [ ] **Step 5: Commit** `docs: variables de entorno de Gemini`
