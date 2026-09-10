# ERP Fábrica de Muebles — Etapa 1: Carga Inicial y Control de Depósito

**Fecha:** 2026-09-10
**Estado:** Diseño aprobado — pendiente de plan de implementación
**Alcance:** MVP Etapa 1 (deadline: cierre del local la próxima semana para conteo físico)

---

## 1. Contexto y objetivo

Sistema de gestión a medida para una fábrica de muebles del hogar (sillones, somieres,
respaldos, mesas, sillas, muebles a medida). El flujo completo del negocio es
Recepción → Venta/Caja → Despacho/Logística → Ganancias, pero **esta etapa cubre
únicamente la carga inicial de inventario y la consulta de depósito**.

### Objetivo de la Etapa 1

Reemplazar las plantillas Excel por una base de datos real: que el encargado de
depósito y el dueño carguen todo el stock contado físicamente mediante una interfaz
rápida tipo planilla, y puedan consultar existencias en tiempo real.

### Criterios de éxito

- Un operador puede cargar **> 200 líneas de stock en < 30 min** usando solo teclado.
- El stock cargado queda auditado: qué variante, qué cantidad, quién y cuándo.
- La vista de depósito refleja el stock al instante tras guardar, con filtros por
  categoría, estado y búsqueda por nombre.
- Desplegado en internet, accesible por 2–4 usuarios con login.

---

## 2. Alcance

### Dentro de alcance

1. **Autenticación básica con roles** (`ADMIN`, `DEPOSITO`).
2. **ABM de Categorías** (6 precargadas).
3. **ABM de Productos + Variantes** (medida / tela / color; costo y precio con override
   por variante).
4. **Módulo de Carga Inicial de Stock**: grilla fast-entry con navegación por teclado y
   guardado por lote transaccional; movimientos tipo `CARGA_INICIAL`.
5. **Vista de Depósito**: consulta de stock en tiempo real con filtros y buscador.
6. **Ajuste manual de stock** puntual con motivo (movimiento `AJUSTE`) — soporte mínimo
   para corregir errores de carga.

### Fuera de alcance (Etapa 1)

Clientes, carrito, ventas, cotizaciones, reservas por seña, pagos parciales, logística,
fletes, hojas de ruta, despachos, dashboards de ganancias. El modelo de datos deja
preparados los `enum` y el ledger de movimientos para incorporar estas etapas sin
migración disruptiva.

---

## 3. Arquitectura y especificación técnica

### 3.1 Stack

| Capa | Elección | Notas |
|---|---|---|
| Framework | **Next.js 16.3.4** (App Router) + **React 19.2** | Turbopack por defecto; Request APIs asíncronas (`params`, `searchParams`, `cookies()`); `proxy.ts` reemplaza a `middleware.ts`. Ya inicializado en el repo. |
| Lenguaje | **TypeScript 5** `strict` | Ya configurado. Alias `@/*` → `src/*`. |
| Estilos | **Tailwind CSS v4** | Ya configurado vía `@tailwindcss/postcss`. |
| Componentes UI | **Primitivas propias** (patrón shadcn/ui, sin CLI) sobre `@radix-ui/react-*` + `lucide-react` | Se copian solo 8 componentes: `Button`, `Input`, `Select`, `Dialog`, `Popover`, `Toast`, `Badge`, `Table`. Todas con targets ≥ 44px y `Dialog` como bottom-sheet en `< sm`. Evita fricción del CLI de shadcn con Tailwind v4 + React 19. |
| Grilla fast-entry | **`@tanstack/react-table` v8** (headless) + navegación por teclado propia + modo tarjeta táctil | Sin licencias, control total del UX (Enter / Tab / flechas en `≥ md`; tarjetas con stepper −／＋ en `< md`). |
| Responsive / dispositivos | **Tailwind v4** (breakpoints default) + hook `useMediaQuery` propio | Sin librería nueva. iPad (principal, con teclado), computadora y celular. Ver §3.7. |
| ORM | **Prisma** | Schema declarativo, migraciones automáticas, tipado. |
| Base de datos | **PostgreSQL en Neon** | Connection string *pooled* (`-pooler`) para funciones serverless de Vercel. |
| Autenticación | **Sesión propia mínima**: JWT firmado con `jose` en cookie `httpOnly` + `bcryptjs` | ~150 LOC. Se descarta `next-auth@5` por estar en beta y el riesgo con Next 16 en un deadline. |
| Validación | **Zod** | Esquemas compartidos cliente + servidor. |
| Deploy | **Vercel** | Variables: `DATABASE_URL`, `DIRECT_URL` (migraciones), `AUTH_SECRET`. |
| Tests | **Vitest** + `@testing-library/react` (unit/componente); Prisma contra base de test para queries/actions | Playwright queda como opcional post-MVP. |

### 3.2 Estructura de carpetas

```
prisma/
  schema.prisma
  seed.ts                  # 6 categorías base + usuario ADMIN inicial
  migrations/

src/
  app/
    layout.tsx             # root (lang="es", metadata del sistema)
    (auth)/
      login/page.tsx       # form -> server action signIn
    (app)/
      layout.tsx           # shell: requireUser() + Sidebar + Header
      page.tsx             # redirect -> /deposito
      deposito/page.tsx    # Server Component: vista de stock (filtros via searchParams)
      carga-inicial/page.tsx   # Client Component: grilla fast-entry
      productos/
        page.tsx               # listado + buscador
        nuevo/page.tsx          # alta producto + variantes
        [id]/page.tsx           # edición producto + ABM variantes
      categorias/page.tsx      # ABM categorías (inline)
      usuarios/page.tsx        # ABM usuarios (solo ADMIN)
    api/
      search/route.ts       # GET autocompletar producto/variante para la grilla

  server/
    db.ts                   # PrismaClient singleton (global en dev)
    auth/
      session.ts            # createSession / readSession / destroySession (jose)
      guards.ts             # requireUser() ; requireRole('ADMIN')
      password.ts           # hashPassword / verifyPassword (bcryptjs)
    actions/
      auth.ts               # 'use server'  signIn, signOut
      categories.ts         # createCategory, updateCategory, archiveCategory
      products.ts           # createProduct, updateProduct, archiveProduct
      variants.ts           # createVariant, updateVariant, archiveVariant
      inventory.ts          # saveInitialStockBatch(rows[]), adjustStock
      users.ts              # createUser, updateUser, deactivateUser  (ADMIN)
    queries/
      products.ts           # listProducts, getProduct, searchProductVariants
      inventory.ts          # listStock(filtros), getVariantStock
    validation/
      category.ts  product.ts  variant.ts  inventory.ts  user.ts   # esquemas zod

  components/
    ui/                     # Button Input Select Dialog Popover Toast Badge Table
                            #   (targets >=44px; Dialog = bottom-sheet en <sm)
    layout/                 # Header, Sidebar (>=lg), NavDrawer (<lg), NavLink, AppNav
    grid/                   # FastEntryGrid (modo tabla + modo tarjeta), GridRowCard,
                            #   useGridKeyboardNav, QuantityStepper, VariantSearchCell
    products/              # ProductFilters (disclosure en <md)
    deposito/             # StockFilters, StockTable (>=md), StockCardList (<md), AdjustStockDialog
    forms/                  # ProductForm, VariantRows (fila|tarjeta), CategoryManager, UserManager

  lib/
    format.ts               # money(ARS), integer, date, slugify
    cn.ts                   # clsx + tailwind-merge
    useMediaQuery.ts        # hook: matchMedia -> boolean (SSR-safe)
    constants.ts            # ROLES, TRANSACTION_TYPES, SEED_CATEGORIES, BREAKPOINTS

proxy.ts                    # redirige a /login si no hay cookie de sesión válida
```

### 3.3 Flujo de datos

- **Lecturas** (depósito, listados): Server Components → `server/queries/*` → Prisma.
  Filtros provienen de `searchParams` (asíncrono en Next 16). Sin `use cache` en Etapa 1.
- **Escrituras**: Server Actions (`'use server'`) → validación Zod → `prisma.$transaction`
  → `revalidatePath()`. **Toda action llama `requireUser()` / `requireRole()` como
  primera línea** (las Server Actions son endpoints `POST` accesibles directamente).
- **Grilla fast-entry**: el cliente mantiene el estado local de filas; el botón
  "Guardar lote" invoca `saveInitialStockBatch(rows)`, que ejecuta **una sola
  transacción**: upsert de `InventoryStock` + inserción de N `InventoryTransaction` con
  un `batchId` común. Devuelve por fila `{ ok } | { error }` para feedback granular.
- **Revalidación**: tras cada mutación, `revalidatePath('/deposito')` y
  `revalidatePath('/productos')` según corresponda.

### 3.4 Autenticación y autorización

- **Sesión**: JWT (`jose`, HS256) con `{ sub: userId, role, name }`, expiración 8 h,
  guardado en cookie `session` `httpOnly` + `secure` + `sameSite=lax`.
- **`proxy.ts`**: intercepta todas las rutas salvo `/login`, `/_next`, `/api/health`;
  si no hay cookie válida → `redirect('/login')`. El proxy solo verifica *presencia y
  firma*; la autorización fina (rol) se hace en cada layout/action.
- **`requireUser()`**: lee y verifica la cookie en el servidor; lanza `redirect('/login')`
  si falla. Usado en `(app)/layout.tsx` y en cada Server Action.
- **`requireRole('ADMIN')`**: además valida `role`. Usado en actions de `usuarios`,
  `categorias` y archivado de productos.
- **Contraseñas**: `bcryptjs` con cost 10. Sin recuperación de contraseña en Etapa 1
  (el ADMIN resetea manualmente desde `/usuarios`).
- **Seed**: crea un usuario `ADMIN` con email y contraseña provistos por variable de
  entorno en el primer deploy (`SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`).

### 3.5 Manejo de errores

- **Validación**: Zod en cliente (feedback inmediato) y servidor (autoridad). Las
  actions devuelven `{ ok: false, fieldErrors }` en vez de lanzar, salvo error inesperado.
- **Grilla**: validación por fila; una fila inválida no aborta el lote — se marca en
  rojo y el resto se guarda. Se informa "N guardadas, M con error".
- **Conflictos de stock negativo**: `CHECK (quantity >= 0)` en `InventoryStock` +
  validación en `adjustStock`; si un `AJUSTE` dejaría negativo, se rechaza con mensaje.
- **Errores de infraestructura** (DB caída): `error.tsx` por segmento con mensaje
  genérico y botón "Reintentar"; se loguea el error en el servidor.
- **404**: `not-found.tsx` para producto/categoría inexistente.

### 3.6 Estrategia de testing

| Nivel | Qué se prueba | Herramienta |
|---|---|---|
| Unit | `lib/format`, esquemas Zod, cálculo de costo/precio efectivo, cálculo de delta en `CARGA_INICIAL` | Vitest |
| Integración | `server/actions/*` y `server/queries/*` contra Postgres de test (migraciones aplicadas, rollback por test) | Vitest + Prisma |
| Componente | `FastEntryGrid` (navegación por teclado, validación por fila), `ProductForm` | Vitest + Testing Library |
| E2E (opcional post-MVP) | login → crear producto → cargar stock → verlo en depósito | Playwright |

Regla TDD: cada action/query y cada componente con lógica se implementa con test primero.

### 3.7 Diseño responsive y multi-dispositivo

El sistema se usa en tres contextos, en orden de importancia:

1. **iPad** (uso principal para la carga de stock) — casi siempre con teclado físico
   (Magic Keyboard o similar), orientación horizontal predominante pero también vertical.
2. **Computadora de escritorio / notebook** — administración, consulta, alta de productos.
3. **Celular** — consulta de depósito y **también carga de stock ocasional**.

No hay diseño "mobile-only" ni "desktop-only": es **una sola UI responsive** que se
reacomoda. Sin librería nueva; Tailwind v4 + un hook `useMediaQuery` propio.

#### Breakpoints (Tailwind v4, defaults)

| Rango | Dispositivo objetivo | Layout |
|---|---|---|
| `< 768px` (base) | Celular (portrait 360–430px) | 1 columna; nav en drawer; tablas como tarjetas apiladas; grilla de carga en modo "tarjeta por fila" |
| `768–1023px` (`md`) | iPad portrait (768–834pt) | 1–2 columnas; nav en drawer; tablas reales con scroll horizontal contenido; grilla de carga en modo tabla |
| `≥ 1024px` (`lg`) | iPad landscape (1024–1194pt), notebook | Sidebar fija persistente; tablas completas; grilla de carga en modo tabla |
| `≥ 1280px` (`xl`) | Escritorio | Igual que `lg` con más aire y anchos máximos |

#### Reglas transversales (aplican a todos los componentes)

- **Targets táctiles ≥ 44×44px** (Apple HIG): botones e inputs con `min-h-11`
  (44px), links de nav con `py-3`, separación ≥ 8px entre elementos tocables.
- **Inputs con `font-size ≥ 16px` en móvil** (`text-base`, y `md:text-sm` si se quiere
  compactar en pantallas grandes) para evitar el auto-zoom de iOS al enfocar.
- **`inputMode` correcto**: `inputMode="numeric"` en todos los campos de cantidad;
  `type="email"` en login. Esto controla el teclado en pantalla del iPad/celular.
- **Sin scroll horizontal de página**: el `body` nunca desborda en X. El contenido
  ancho (tablas, grilla) scrollea dentro de su propio contenedor `overflow-x-auto`.
- **Safe areas**: `viewport-fit=cover` + `env(safe-area-inset-*)` en barras fijas
  (header, barra de acción de la grilla, drawer) para no quedar bajo el notch / la
  home bar del iPad.
- **`touch-action: manipulation`** y `-webkit-tap-highlight-color: transparent`
  globales para eliminar el delay de 300ms y el flash gris al tocar.
- **Zoom del usuario habilitado** (no se fija `maximum-scale`): accesibilidad.
- **Estados de foco visibles** (`:focus-visible`) — sirven con teclado (iPad/desktop) y
  no molestan en touch.

#### Adaptaciones por pantalla

**App shell (`(app)/layout.tsx`)**
- `≥ lg`: `<Sidebar>` fija a la izquierda + `<Header>` arriba.
- `< lg`: `<Header>` con botón hamburguesa que abre la navegación en un **drawer
  lateral** (Radix Dialog como sheet, desde la izquierda, con overlay). El drawer se
  cierra al navegar. El ítem activo se resalta igual que en la sidebar.

**Tablas de listado (`/deposito`, `/productos`)**
- `≥ md`: tabla real, envuelta en `overflow-x-auto`.
- `< md`: **lista de tarjetas** — cada registro es una `<article>` con el nombre del
  producto/variante destacado y los demás campos como pares etiqueta/valor; la acción
  (p. ej. "Ajustar") es un botón de ancho completo.
- Ambas variantes se renderizan siempre en el DOM y se muestran/ocultan por CSS
  (`hidden md:block` / `md:hidden`); no hay bifurcación por JS ni riesgo de hidratación.
- **Filtros**: la búsqueda siempre visible; los selects (categoría, estado) se colapsan
  en un disclosure "Filtros" en `< md` y quedan en línea en `≥ md`. El pie con totales
  queda fijo abajo de la tarjeta-lista en móvil.

**Grilla de carga inicial (`FastEntryGrid`)** — el componente más sensible:
- Modo se decide con `useMediaQuery('(min-width: 768px)')`:
  - **`≥ md` — modo tabla** (iPad landscape/portrait, desktop): la grilla tipo planilla.
    Navegación por teclado (Enter = nueva fila, Tab, ↑/↓ en cantidad, Esc = borrar
    fila) como **camino principal**. Además: cada celda con target ≥ 44px,
    `inputMode="numeric"` en cantidad, botón "＋ Agregar fila" y borrar-fila tocables,
    y una **barra de acción fija abajo** ("Guardar lote" + resumen) siempre alcanzable
    con el pulgar en iPad.
  - **`< md` — modo tarjeta** (celular): cada fila es una tarjeta con el buscador de
    producto/variante arriba (ancho completo), y abajo un campo de cantidad grande con
    botones **−／＋** a los lados (stepper) además del input numérico. Botón "Agregar
    ítem" al final. "Guardar lote" en barra fija inferior. Las flechas/Enter de teclado
    siguen funcionando si hay teclado, pero nada depende de ellas.
- El teclado físico se detecta implícitamente: los handlers de teclado están siempre
  activos; en táctil puro simplemente no se disparan y la UI es 100% operable con dedos.

**Formularios (`ProductForm`, `VariantRows`, `CategoryManager`, `UserManager`)**
- 1 columna en `< md`; grilla de 2 columnas en `≥ md` donde tenga sentido (p. ej.
  costo/precio lado a lado).
- `VariantRows`: en `< md` cada variante es una tarjeta con campos apilados; en `≥ md`
  es una fila de inputs. Botón "Agregar variante" de ancho completo en móvil.

**Diálogos (`Dialog`)**
- `< sm`: hoja inferior (bottom sheet) de ancho completo que sube desde abajo, con
  `env(safe-area-inset-bottom)`.
- `≥ sm`: modal centrado con `max-w`.

#### Impacto en testing

- `useMediaQuery`: test unitario mockeando `window.matchMedia`.
- `FastEntryGrid`: los tests fuerzan el modo con una prop `mode?: 'table' | 'card'`
  (default: derivado de `useMediaQuery`) para poder probar ambos sin `matchMedia`.
- Tablas responsive: el test verifica que **tanto** la tabla como la lista de tarjetas
  están en el DOM (la visibilidad es CSS y no se prueba en jsdom).
- Navegación por teclado: se sigue probando en el modo tabla.

---

## 4. Esquema de base de datos

PostgreSQL vía Prisma. Todas las PK son `uuid`. Montos `Decimal(12,2)`. Cantidades `Int`.

```prisma
enum Role            { ADMIN  DEPOSITO }
enum TransactionType { CARGA_INICIAL  AJUSTE }
// Etapas futuras: VENTA, RESERVA, DESPACHO, DEVOLUCION, RECEPCION

model User {
  id           String   @id @default(uuid()) @db.Uuid
  email        String   @unique
  passwordHash String
  name         String
  role         Role     @default(DEPOSITO)
  active       Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  transactions InventoryTransaction[]
}

model Category {
  id         String    @id @default(uuid()) @db.Uuid
  name       String    @unique
  slug       String    @unique
  archivedAt DateTime?
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt
  products   Product[]
}

model Product {
  id           String    @id @default(uuid()) @db.Uuid
  categoryId   String    @db.Uuid
  category     Category  @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  name         String                              // Modelo / Nombre
  description   String?
  defaultCost  Decimal?  @db.Decimal(12, 2)        // costo directo sugerido
  defaultPrice Decimal?  @db.Decimal(12, 2)        // PVP sugerido
  archivedAt   DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  variants     ProductVariant[]

  @@unique([categoryId, name])
  @@index([categoryId])
}

model ProductVariant {
  id         String    @id @default(uuid()) @db.Uuid
  productId  String    @db.Uuid
  product    Product   @relation(fields: [productId], references: [id], onDelete: Restrict)
  name       String                               // "2 cuerpos · Chenille · Gris" (autogenerada, editable)
  medida     String?
  tela       String?
  color      String?
  cost       Decimal?  @db.Decimal(12, 2)          // override; si null hereda product.defaultCost
  price      Decimal?  @db.Decimal(12, 2)          // override; si null hereda product.defaultPrice
  sku        String?   @unique
  isDefault  Boolean   @default(false)             // variante "Única" autocreada
  archivedAt DateTime?
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt
  stock        InventoryStock?
  transactions InventoryTransaction[]

  @@unique([productId, name])
  @@index([productId])
}

model InventoryStock {                             // snapshot 1:1 de existencias actuales (lectura rápida)
  id        String   @id @default(uuid()) @db.Uuid
  variantId String   @unique @db.Uuid
  variant   ProductVariant @relation(fields: [variantId], references: [id], onDelete: Cascade)
  quantity  Int      @default(0)                   // CHECK (quantity >= 0) añadido por migración SQL manual
  updatedAt DateTime @updatedAt
}

model InventoryTransaction {                       // ledger append-only (fuente de verdad / auditoría)
  id            String   @id @default(uuid()) @db.Uuid
  variantId     String   @db.Uuid
  variant       ProductVariant @relation(fields: [variantId], references: [id], onDelete: Restrict)
  type          TransactionType
  quantityDelta Int                                // cambio con signo efectivamente aplicado
  quantityAfter Int                                // existencias resultantes (auditoría)
  note          String?
  userId        String   @db.Uuid
  user          User     @relation(fields: [userId], references: [id], onDelete: Restrict)
  batchId       String?  @db.Uuid                  // agrupa filas guardadas juntas desde la grilla
  createdAt     DateTime @default(now())

  @@index([variantId, createdAt])
  @@index([batchId])
}
```

### 4.1 Relaciones

```
Category 1───* Product 1───* ProductVariant 1───1 InventoryStock
                                   │
                                   *
                                   │
                          InventoryTransaction *───1 User
```

- `Category → Product`: `onDelete: Restrict` (no se borra una categoría con productos).
- `Product → ProductVariant`: `onDelete: Restrict` (se usa `archivedAt`).
- `ProductVariant → InventoryStock`: `onDelete: Cascade` (el snapshot no tiene sentido sin la variante).
- `ProductVariant → InventoryTransaction`: `onDelete: Restrict` (historia inmutable).
- `User → InventoryTransaction`: `onDelete: Restrict` (no se borra un usuario con movimientos; se usa `active=false`).

### 4.2 Reglas de negocio en datos

1. **Autocreación de variante**: al crear un `Product` sin variantes explícitas, se crea
   una `ProductVariant` con `isDefault=true`, `name="Única"`. Un producto siempre tiene
   ≥ 1 variante activa.
2. **Costo/Precio efectivo**: `efectivoCost = coalesce(variant.cost, product.defaultCost)`;
   ídem `efectivoPrice`. Se calcula en `server/queries`, no se persiste.
3. **`name` de variante**: si el usuario no lo escribe, se autogenera concatenando
   `medida · tela · color` (los no vacíos). Editable.
4. **`CARGA_INICIAL` — ajuste absoluto**: la action recibe `contado` (entero ≥ 0). En una
   transacción:
   - lee `stock.quantity` actual (`0` si no existe `InventoryStock`);
   - `delta = contado - actual`;
   - `upsert InventoryStock { quantity: contado }`;
   - `insert InventoryTransaction { type: CARGA_INICIAL, quantityDelta: delta,
     quantityAfter: contado, userId, batchId }`.
   Recontar es simplemente otra `CARGA_INICIAL` (nuevo `delta`, nuevo `batchId`).
5. **`AJUSTE`**: corrige una variante puntual. Recibe `nuevaCantidad` + `note`
   (obligatoria). Misma mecánica de delta; rechaza si `nuevaCantidad < 0`.
6. **Borrado**: siempre soft (`archivedAt` / `active`). Categorías y productos con
   historial no se borran físicamente.
7. **Reconciliación**: `InventoryStock.quantity` debe ser igual a
   `SUM(quantityDelta)` del ledger para esa variante. Script `prisma/scripts/reconcile.ts`
   lo verifica y reporta discrepancias (no corre en runtime).

---

## 5. User Stories y criterios de aceptación

Formato Gherkin (Dado / Cuando / Entonces). Prioridad: **P0** = imprescindible para el
deadline, **P1** = deseable, **P2** = si sobra tiempo.

### Épica A — Autenticación y usuarios

#### A1 (P0) — Iniciar sesión
> **Como** encargado de depósito
> **Quiero** ingresar con email y contraseña
> **Para** acceder al sistema de forma segura.

- **Dado** que estoy en `/login` **y** ingreso credenciales válidas **cuando** envío el
  formulario **entonces** se crea una cookie de sesión y soy redirigido a `/deposito`.
- **Dado** credenciales inválidas **cuando** envío **entonces** veo "Email o contraseña
  incorrectos" y no se crea sesión.
- **Dado** un usuario con `active=false` **cuando** intenta ingresar con credenciales
  correctas **entonces** el ingreso es rechazado con "Usuario inactivo".
- **Dado** que no tengo sesión **cuando** navego a cualquier ruta protegida **entonces**
  soy redirigido a `/login`.

#### A2 (P0) — Cerrar sesión
- **Dado** que tengo sesión **cuando** hago clic en "Salir" **entonces** la cookie se
  elimina y soy redirigido a `/login`.

#### A3 (P0) — Seed de administrador
- **Dado** una base recién migrada **cuando** se ejecuta el seed **entonces** existe un
  usuario `ADMIN` con las credenciales de `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` y
  las 6 categorías base.

#### A4 (P1) — ABM de usuarios (solo ADMIN)
- **Dado** que soy `ADMIN` **cuando** entro a `/usuarios` **entonces** veo la lista de
  usuarios con su rol y estado.
- **Dado** que soy `ADMIN` **cuando** creo un usuario con email, nombre, rol y
  contraseña temporal **entonces** el usuario queda activo y puede iniciar sesión.
- **Dado** que soy `ADMIN` **cuando** desactivo un usuario **entonces** ese usuario no
  puede volver a ingresar pero sus movimientos históricos se conservan.
- **Dado** que soy `DEPOSITO` **cuando** intento entrar a `/usuarios` **entonces** recibo
  403 / redirección a `/deposito`.

### Épica B — Categorías

#### B1 (P0) — Ver categorías
- **Dado** que tengo sesión **cuando** entro a `/categorias` **entonces** veo las 6
  categorías (Somieres, Respaldos, Sillones, Mesas, Sillas, Muebles a medida / Otros)
  con la cantidad de productos activos de cada una.

#### B2 (P1) — Crear categoría
- **Dado** un nombre no repetido **cuando** creo la categoría **entonces** aparece en la
  lista y su `slug` se genera automáticamente.
- **Dado** un nombre que ya existe **cuando** intento crear **entonces** veo "Ya existe
  una categoría con ese nombre".

#### B3 (P1) — Renombrar categoría
- **Dado** una categoría existente **cuando** cambio su nombre a uno no repetido
  **entonces** se actualiza y los productos asociados no cambian.

#### B4 (P1) — Archivar categoría
- **Dado** una categoría **sin** productos activos **cuando** la archivo **entonces**
  deja de aparecer en los selectores de alta de producto.
- **Dado** una categoría **con** productos activos **cuando** intento archivarla
  **entonces** la acción se rechaza con "No se puede archivar: tiene productos activos".

### Épica C — Productos y variantes

#### C1 (P0) — Crear producto con variantes
> **Como** encargado de depósito
> **Quiero** dar de alta un modelo con sus variantes
> **Para** poder cargarle stock después.

- **Dado** que completo nombre, categoría y (opcional) costo/precio sugerido **cuando**
  guardo sin agregar variantes **entonces** el producto se crea con una variante
  `isDefault=true` llamada "Única".
- **Dado** que agrego 1..N variantes con medida/tela/color **cuando** guardo **entonces**
  cada variante se crea; si no escribí su nombre, se autogenera de
  `medida · tela · color`.
- **Dado** una variante con costo/precio propios **cuando** guardo **entonces** esos
  valores sobrescriben los del producto para esa variante.
- **Dado** nombre de producto repetido dentro de la misma categoría **cuando** guardo
  **entonces** veo "Ya existe un producto con ese nombre en la categoría".
- **Dado** dos variantes con el mismo nombre en el mismo producto **cuando** guardo
  **entonces** veo error de nombre duplicado.

#### C2 (P0) — Listar y buscar productos
- **Dado** que entro a `/productos` **entonces** veo una tabla paginada con Producto,
  Categoría, N.º de variantes, y costo/precio sugerido.
- **Dado** que escribo en el buscador **entonces** la lista filtra por nombre de producto
  (case-insensitive) en < 500 ms.
- **Dado** que filtro por categoría **entonces** solo veo productos de esa categoría.

#### C3 (P0) — Editar producto y ABM de variantes
- **Dado** un producto existente **cuando** edito nombre/categoría/costo/precio y guardo
  **entonces** se actualiza.
- **Dado** un producto **cuando** agrego una variante nueva **entonces** queda disponible
  para carga de stock inmediatamente.
- **Dado** una variante **sin** movimientos de stock **cuando** la archivo **entonces**
  desaparece de la grilla de carga y de la vista de depósito.
- **Dado** una variante **con** stock > 0 o movimientos **cuando** intento archivarla
  **entonces** se rechaza con "La variante tiene stock o movimientos".
- **Dado** un producto **cuando** intento archivar su última variante activa **entonces**
  se rechaza ("El producto debe tener al menos una variante").

#### C4 (P1) — Archivar producto
- **Dado** un producto **cuando** lo archivo **entonces** él y sus variantes dejan de
  aparecer en carga y depósito, pero su historial se conserva.

### Épica D — Carga inicial de stock (grilla fast-entry)

#### D1 (P0) — Agregar filas por búsqueda
> **Como** encargado de depósito
> **Quiero** buscar un producto y variante y sumarlo a la planilla
> **Para** cargar el conteo físico rápido.

- **Dado** que estoy en `/carga-inicial` **cuando** escribo ≥ 2 caracteres en el buscador
  de la fila **entonces** veo sugerencias de "Producto — Variante (Categoría)" en < 300 ms.
- **Dado** que selecciono una sugerencia **entonces** la fila queda fijada a esa variante
  y el foco pasa al campo "Cantidad contada".
- **Dado** que agrego una variante que ya está en otra fila de la planilla **entonces**
  veo un aviso "Ya está en la fila N" y no se duplica.

#### D2 (P0) — Navegación por teclado (iPad con teclado / desktop)
Aplica en el **modo tabla** (`≥ md`). Es el camino principal de carga en iPad con Magic
Keyboard y en computadora.
- **Dado** el foco en "Cantidad" de una fila **cuando** presiono `Enter` **entonces** se
  crea/enfoca la fila siguiente (buscador).
- **Cuando** presiono `Tab` / `Shift+Tab` **entonces** el foco avanza/retrocede entre
  celdas editables en orden lógico.
- **Cuando** presiono `↑` / `↓` en la columna Cantidad **entonces** el foco salta a la
  misma columna de la fila anterior/siguiente.
- **Cuando** presiono `Esc` en una fila sin guardar **entonces** la fila se elimina.
- **Dado** que no hay teclado físico **entonces** la grilla sigue siendo 100% operable
  solo con toques (ver D7); ningún flujo depende de estas teclas.

#### D3 (P0) — Validación por fila
- **Dado** una fila sin variante seleccionada **cuando** intento guardar el lote
  **entonces** esa fila se marca en rojo con "Seleccioná un producto/variante" y no se
  incluye en el guardado.
- **Dado** una cantidad vacía, negativa o no entera **entonces** la fila se marca en rojo
  con el motivo.
- **Dado** filas válidas e inválidas mezcladas **cuando** guardo **entonces** se guardan
  solo las válidas y veo "N guardadas, M con error".

#### D4 (P0) — Guardado por lote transaccional
- **Dado** un conjunto de filas válidas **cuando** hago clic en "Guardar lote"
  **entonces** en **una sola transacción** se hace `upsert` de `InventoryStock` y se
  inserta un `InventoryTransaction` `CARGA_INICIAL` por cada fila, todas con el mismo
  `batchId` y mi `userId`.
- **Dado** que una fila indica `contado = 8` y la variante tenía `3` **entonces** el
  movimiento registra `quantityDelta = 5` y `quantityAfter = 8`, y el stock queda en `8`.
- **Dado** que la transacción falla a mitad **entonces** no se persiste ninguna fila del
  lote (todo o nada).
- **Dado** un guardado exitoso **cuando** vuelvo a `/deposito` **entonces** los valores
  reflejan el lote recién cargado (revalidación).

#### D5 (P1) — Reanudar carga / recontar
- **Dado** que guardé un lote y sigo contando **cuando** agrego la misma variante con un
  nuevo `contado` **entonces** se registra otra `CARGA_INICIAL` con el nuevo delta y el
  stock queda en el último valor contado.

#### D6 (P2) — Pegar desde Excel
- **Dado** que copio una columna de cantidades desde Excel **cuando** pego sobre la
  columna Cantidad **entonces** se completan las filas correspondientes en orden.

#### D7 (P0) — Carga táctil (celular / iPad sin teclado)
- **Dado** un ancho `< md` **cuando** entro a `/carga-inicial` **entonces** cada ítem se
  muestra como una **tarjeta**: buscador de producto/variante arriba y, abajo, un campo
  de cantidad grande con botones **−／＋** a los lados.
- **Dado** que toco `＋` o `−` **entonces** la cantidad sube/baja de a 1 (mínimo 0), sin
  necesidad de abrir el teclado.
- **Dado** que toco el campo de cantidad **entonces** el iPad/celular abre el **teclado
  numérico** (`inputMode="numeric"`).
- **Dado** que toco "Agregar ítem" **entonces** aparece una tarjeta nueva vacía y el foco
  va a su buscador.
- **Dado** cualquier ancho **entonces** el botón "Guardar lote" y el resumen "N
  guardadas, M con error" están en una **barra fija inferior** siempre visible (respeta
  el área segura del dispositivo).
- **Dado** que todos los targets tocables miden ≥ 44×44px.

### Épica E — Vista de depósito

#### E1 (P0) — Consultar stock
> **Como** dueño
> **Quiero** ver todo el stock disponible en tiempo real
> **Para** saber qué hay y cuánto vale.

- **Dado** un ancho `≥ md` **entonces** veo una tabla con columnas: Producto, Variante,
  Categoría, Stock actual, Costo unitario (efectivo), Precio venta (efectivo).
- **Dado** un ancho `< md` (celular) **entonces** veo la misma información como **lista de
  tarjetas**: nombre de producto y variante destacados, y Categoría / Stock / Costo /
  Precio como pares etiqueta-valor; la acción "Ajustar" es un botón de ancho completo.
- **Dado** que una variante no tiene `InventoryStock` **entonces** su Stock actual se
  muestra como `0`.
- **Dado** el pie de la lista **entonces** veo el total de variantes listadas y la suma
  de unidades en stock (fijo abajo en móvil).

#### E2 (P0) — Filtrar y buscar
- **Dado** que selecciono una categoría **entonces** la tabla filtra por esa categoría
  (vía `searchParams`, URL compartible).
- **Dado** que elijo estado "Disponible" **entonces** solo veo variantes con
  `stock > 0`; con "Sin stock" solo `stock = 0`; "Todos" no filtra.
- **Dado** que escribo en el buscador **entonces** filtra por nombre de producto o de
  variante (case-insensitive).
- **Dado** filtros activos **cuando** recargo la página **entonces** los filtros
  persisten (están en la URL).
- **Dado** un ancho `< md` **entonces** la búsqueda queda siempre visible y los selects
  (categoría, estado) se agrupan en un disclosure "Filtros" colapsable.

#### E3 (P1) — Ordenar
- **Dado** que hago clic en un encabezado (Producto, Stock, Precio) **entonces** la tabla
  se ordena asc/desc por esa columna.

### Épica F — Ajuste manual de stock

#### F1 (P1) — Corregir stock de una variante
> **Como** encargado de depósito
> **Quiero** corregir la cantidad de una variante con un motivo
> **Para** arreglar errores de conteo sin rehacer todo.

- **Dado** una variante en `/deposito` **cuando** abro "Ajustar" e ingreso nueva
  cantidad + motivo (obligatorio) **entonces** se registra un `InventoryTransaction`
  `AJUSTE` con el delta y el stock se actualiza.
- **Dado** una nueva cantidad negativa **entonces** la acción se rechaza.
- **Dado** motivo vacío **entonces** la acción se rechaza con "El motivo es obligatorio".
- **Dado** un ancho `< sm` **entonces** "Ajustar" abre una hoja inferior (bottom sheet)
  a ancho completo en vez de un modal centrado.

### Épica G — Uso multi-dispositivo (iPad / celular / computadora)

#### G1 (P0) — Navegación adaptable
- **Dado** un ancho `≥ lg` (iPad landscape, notebook) **entonces** la navegación es una
  **sidebar fija** siempre visible.
- **Dado** un ancho `< lg` (iPad portrait, celular) **entonces** la navegación se abre
  desde un botón hamburguesa como **drawer lateral** con overlay, y se cierra al elegir
  una opción.
- **Dado** cualquier ancho **entonces** el ítem de la sección actual se muestra resaltado.

#### G2 (P0) — Ergonomía táctil
- **Dado** cualquier pantalla **entonces** todos los botones, inputs y links tienen un
  área tocable de **≥ 44×44px** y separación suficiente para no tocar el equivocado.
- **Dado** que enfoco un input en iPad/celular **entonces** la página **no hace zoom
  automático** (tamaño de fuente ≥ 16px en móvil).
- **Dado** un campo de cantidad o de precio **entonces** el dispositivo abre el **teclado
  numérico**.
- **Dado** una barra fija (header, acción de la grilla, drawer) **entonces** respeta el
  **área segura** del dispositivo (no queda tapada por notch / home bar).

#### G3 (P0) — Sin scroll horizontal de página
- **Dado** cualquier pantalla **entonces** el contenido nunca genera scroll horizontal a
  nivel de página; las tablas anchas scrollean dentro de su propio contenedor.

#### G4 (P0) — Continuidad entre dispositivos
- **Dado** que empiezo una tarea en iPad y la sigo en la computadora (o viceversa)
  **entonces** la funcionalidad es la misma; solo cambia la disposición.

---

## 6. Consideraciones de despliegue

- **Neon**: proyecto Postgres; usar la connection string *pooled* como `DATABASE_URL` y
  la *direct* como `DIRECT_URL` (Prisma `directUrl` para migraciones).
- **Vercel**: importar el repo; variables de entorno `DATABASE_URL`, `DIRECT_URL`,
  `AUTH_SECRET`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`. Build command estándar
  (`next build`). `prisma generate` en `postinstall`.
- **Migraciones**: `prisma migrate deploy` como paso previo (script de release o
  ejecución manual una vez) + `prisma db seed` la primera vez.
- **Health check**: `GET /api/health` devuelve `200` si la DB responde (`SELECT 1`).
- **Región**: elegir la región de Vercel y de Neon en la misma zona (p. ej. `us-east`)
  para minimizar latencia.

---

## 7. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Deadline ajustado (1 semana) | Alto | Priorización P0/P1/P2; P0 es un vertical completo (login → producto → carga → depósito). |
| Datos sucios en el conteo físico | Medio | Validación por fila en la grilla; ajuste manual `AJUSTE` con motivo. |
| Latencia DB en serverless | Medio | Neon pooled + misma región que Vercel; queries indexadas. |
| Next.js 16 muy nuevo (APIs cambiadas) | Medio | Consultar `node_modules/next/dist/docs/` antes de cada feature; `proxy.ts` en vez de `middleware`; Request APIs `async`. |
| `next-auth` beta inestable | Medio | Se evita: sesión propia con `jose` + `bcryptjs`. |
| Grilla fast-entry: UX de teclado compleja | Medio | Componente aislado `FastEntryGrid` con tests de teclado; `@tanstack/react-table` headless. |
| Grilla en dos modos (tabla/tarjeta) duplica superficie de UI y de bugs | Medio | Lógica compartida (`validateRow`, estado de filas, `saveInitialStockBatch`); solo cambia el render. Prop `mode` para testear ambos. iPad (uso principal) usa el modo tabla ya cubierto. |
| Auto-zoom de iOS al enfocar inputs / targets chicos en táctil | Medio | Regla global: inputs ≥ 16px en móvil, targets ≥ 44px, `inputMode` correcto. Verificación manual en iPad real antes del deploy. |
| Desfasaje `InventoryStock` vs ledger | Bajo | Escrituras siempre en `$transaction`; script `reconcile.ts`. |

---

## 8. Decisiones registradas

| Tema | Decisión |
|---|---|
| Base de datos / hosting | PostgreSQL en **Neon** + app en **Vercel** |
| ORM | **Prisma** |
| Autenticación | **Sesión propia** (`jose` + `bcryptjs`), usuarios con roles `ADMIN` / `DEPOSITO` |
| Granularidad de stock | **Siempre a nivel variante**; producto sin variantes → variante "Única" autocreada |
| Atributos de variante | **3 campos fijos opcionales** (`medida`, `tela`, `color`) + `name` |
| Costo / Precio | **En la variante con default heredado del producto** (`coalesce`) |
| Semántica `CARGA_INICIAL` | **Ajuste absoluto** (la cantidad cargada es el stock resultante; se registra el delta) |
| Import CSV/Excel | **Fuera de Etapa 1** (solo grilla interactiva) |
| UI | Primitivas propias (patrón shadcn/ui) sobre Radix + `lucide-react`, Tailwind v4 |
| Grilla | `@tanstack/react-table` v8 headless + navegación por teclado propia + modo tarjeta táctil |
| Responsive | **Una sola UI responsive** (sin app separada). Dispositivos: iPad (principal, casi siempre con teclado), computadora, celular (también carga). Breakpoints Tailwind default; corte de layout en `lg` (sidebar) y `md` (tabla↔tarjeta). Ver §3.7. |
| Conectividad | **Wifi estable en el local** → sin offline ni cola local; cada lote se guarda contra el servidor. |
| Tests | Vitest + Testing Library; integración de actions/queries contra Postgres de test; `useMediaQuery` con `matchMedia` mockeado |

---

## 9. Próximo paso

Generar el **plan de implementación paso a paso** (skill `writing-plans`) con tareas
ordenadas, dependencias, y checkpoints de review, cubriendo desde el setup del proyecto
hasta el deploy del MVP.
