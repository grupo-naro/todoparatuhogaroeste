# Punto de venta: rol Vendedora, ventas con descuento de stock y comprobante imprimible

## Contexto y objetivo

Hoy el sistema permite cargar catálogo (productos/variantes/categorías) y
controlar stock (`/deposito`), pero no hay forma de registrar una venta. Se
necesita:

1. Un rol nuevo, **`VENDEDOR`**, para el personal de venta — puede vender
   pero no administrar catálogo, usuarios ni ajustar stock manualmente desde
   `/deposito` (eso sigue siendo `ADMIN`/`DEPOSITO`).
2. Una pantalla de venta (`/ventas/nueva`) tipo carrito: buscar
   producto/variante, agregar cantidad, ver el total, elegir método de pago
   y confirmar. La confirmación descuenta stock automáticamente.
3. Un comprobante interno imprimible por venta — **no es una factura fiscal**
   (el usuario confirmó que no hace falta integración con AFIP/ARCA); es un
   ticket con numeración interna que se le da al cliente. Al confirmar la
   venta se dispara el diálogo de impresión del navegador solo.
4. Un historial de ventas (`/ventas`) con la posibilidad de anular una venta
   ya registrada, lo que repone el stock.

## Alcance

### Dentro de alcance

1. Rol `VENDEDOR` (ABM de usuarios ya existente en `/usuarios` lo soporta
   agregándolo al enum — sin cambios de UI ahí más que el nuevo valor en el
   `<select>` de rol).
2. Pantalla `/ventas/nueva`: alta de venta con búsqueda de variantes (con
   stock visible), carrito, total en vivo, método de pago, confirmación
   transaccional.
3. Descuento de stock automático al confirmar, usando el mismo ledger
   (`InventoryTransaction`) que ya existe — nuevo tipo `VENTA`.
4. Comprobante imprimible por venta (`/ventas/[id]`), disparado
   automáticamente al confirmar y reimprimible después desde el historial.
5. Historial `/ventas`: lista de ventas con fecha, vendedora, método de pago,
   total; permite anular una venta (repone stock, tipo `ANULACION`).

### Fuera de alcance (esta iteración)

Factura fiscal / integración AFIP-ARCA, impresora térmica/ESC-POS, clientes
registrados (todo es "consumidor final" anónimo), precios editables o
descuentos por línea, pagos parciales/combinados, múltiples cajas o cierre
de turno/arqueo, devoluciones parciales de una venta (la anulación es de la
venta completa), lector de código de barras.

## Modelo de datos

`prisma/schema.prisma`:

```prisma
enum Role {
  ADMIN
  DEPOSITO
  VENDEDOR
}

enum TransactionType {
  CARGA_INICIAL
  AJUSTE
  VENTA
  ANULACION
}

enum PaymentMethod {
  EFECTIVO
  TARJETA
  TRANSFERENCIA
}

model Sale {
  id            String        @id @default(uuid()) @db.Uuid
  number        Int           @unique @default(autoincrement())
  userId        String        @db.Uuid
  user          User          @relation("SaleUser", fields: [userId], references: [id], onDelete: Restrict)
  paymentMethod PaymentMethod
  total         Decimal       @db.Decimal(12, 2)
  cancelledAt   DateTime?
  cancelledById String?       @db.Uuid
  cancelledBy   User?         @relation("SaleCancelledBy", fields: [cancelledById], references: [id], onDelete: Restrict)
  items         SaleItem[]
  createdAt     DateTime      @default(now())

  @@index([createdAt])
}

model SaleItem {
  id         String         @id @default(uuid()) @db.Uuid
  saleId     String         @db.Uuid
  sale       Sale           @relation(fields: [saleId], references: [id], onDelete: Cascade)
  variantId  String         @db.Uuid
  variant    ProductVariant @relation(fields: [variantId], references: [id], onDelete: Restrict)
  quantity   Int
  unitPrice  Decimal        @db.Decimal(12, 2)
  subtotal   Decimal        @db.Decimal(12, 2)

  @@index([saleId])
}
```

Notas:

- **`number` es un `Int` autoincremental separado del `id` (uuid)** —  es el
  número de comprobante que ve el cliente ("Ticket N° 42"), correlativo y
  fácil de leer/buscar, generado por una secuencia de Postgres (concurrency-safe,
  a diferencia de calcular `count() + 1` en la app).
- **`unitPrice`/`subtotal` quedan congelados en `SaleItem`** al momento de la
  venta — si después cambia el precio del producto, las ventas viejas no se
  alteran (mismo criterio que ya usa `InventoryTransaction.quantityAfter`
  como snapshot).
- **Nunca se borra una `Sale` físicamente.** Es un registro contable; anular
  es `cancelledAt`/`cancelledById` (mismo espíritu que `active` en `User`,
  no el borrado físico que sí se usa para catálogo). Esto es una excepción
  deliberada a la migración a borrado físico que tuvo el catálogo — ahí
  aplicaba porque un producto borrado no tiene historia que preservar; una
  venta sí.
- `User` necesita dos relaciones nombradas (`SaleUser`/`SaleCancelledBy`)
  porque hay dos FKs a la misma tabla.
- Migración nueva + aplicar con `prisma migrate deploy` en la base real y en
  la de test de Docker, igual que en las iteraciones anteriores.

`src/lib/constants.ts`:

```ts
export const ROLES = ['ADMIN', 'DEPOSITO', 'VENDEDOR'] as const
export const TRANSACTION_TYPES = ['CARGA_INICIAL', 'AJUSTE', 'VENTA', 'ANULACION'] as const
export const PAYMENT_METHODS = ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'] as const
export type PaymentMethodName = (typeof PAYMENT_METHODS)[number]
```

## Roles y permisos

`src/server/auth/guards.ts` — `requireRole` hoy solo acepta un rol único.
Se extiende a aceptar uno o varios (mínimo diff, sin romper las llamadas
existentes que pasan un string):

```ts
export async function requireRole(role: RoleName | RoleName[]): Promise<SessionPayload> {
  const session = await requireUser()
  const allowed = Array.isArray(role) ? role : [role]
  if (!allowed.includes(session.role)) redirect('/productos')
  return session
}
```

- `/ventas`, `/ventas/nueva`, `/ventas/[id]` y sus Server Actions:
  `requireRole(['ADMIN', 'VENDEDOR'])`.
- `/deposito` y sus acciones (`adjustStock`) **no cambian** — siguen abiertas
  a cualquier usuario autenticado como hoy (no hay un `requireRole` ahí
  actualmente); no es parte de este trabajo endurecer eso.
- `navItems.ts`: el campo `adminOnly?: boolean` no alcanza (necesito
  "ADMIN o VENDEDOR, pero no DEPOSITO"). Se generaliza a `roles?: RoleName[]`
  (si no está presente, visible para todos — igual que hoy):

```ts
export type NavItem = { href: string; label: string; icon: LucideIcon; roles?: RoleName[] }
// ...
{ href: '/ventas', label: 'Ventas', icon: ShoppingCart, roles: ['ADMIN', 'VENDEDOR'] },
{ href: '/usuarios', label: 'Usuarios', icon: Users, roles: ['ADMIN'] },

export function navItemsFor(role: RoleName): NavItem[] {
  return ALL.filter((i) => !i.roles || i.roles.includes(role))
}
```

(`adminOnly: true` en la entrada de Usuarios se reemplaza por
`roles: ['ADMIN']`, equivalente.)

## Queries y acciones del servidor

`src/server/queries/sales.ts` (nuevo):

- `searchSellableVariants(q: string, limit = 20)`: como
  `searchProductVariants` (Task 12, hoy sin uso real) pero con el stock
  incluido — `{ variantId, productName, variantName, categoryName, quantity }`
  — para que la vendedora vea cuánto queda disponible mientras busca. Reimplementa
  la búsqueda en vez de extender `searchProductVariants` para no tocar una
  función ya testeada y potencialmente reusada en otro lado.
- `listSales(params: { from?: Date; to?: Date })`: para el historial —
  `{ id, number, createdAt, userName, paymentMethod, total, cancelledAt }[]`,
  orden `createdAt desc`.
- `getSale(id: string)`: detalle completo con items (para `/ventas/[id]`,
  la vista de comprobante y anulación) — incluye `productName`/`variantName`
  por ítem (no solo el id) para poder imprimir el ticket sin otra consulta.

`src/server/validation/sales.ts` (nuevo):

```ts
export const saleItemInputSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.coerce.number().int('Debe ser un entero').min(1, 'Mínimo 1 unidad'),
})
export const createSaleSchema = z.object({
  items: z.array(saleItemInputSchema).min(1, 'Agregá al menos un producto'),
  paymentMethod: z.enum(PAYMENT_METHODS, { message: 'Elegí un método de pago' }),
})
```

`src/server/actions/sales.ts` (nuevo):

- `createSale(input)`: `requireRole(['ADMIN', 'VENDEDOR'])`. Valida con
  `createSaleSchema`. Dentro de **una** `prisma.$transaction`: por cada ítem,
  lee `InventoryStock` actual, calcula `unitPrice` con
  `effectivePrice`/`effectiveCost` (igual que `listStock`), verifica
  `quantity ≤ stock` — si algún ítem no alcanza, aborta toda la transacción
  (no se vende "lo que sí había" parcialmente) y devuelve qué ítem falló;
  si todo alcanza, decrementa cada `InventoryStock`, crea un
  `InventoryTransaction` por ítem (`type: 'VENTA'`, delta negativo,
  vinculado a la venta vía un campo existente reutilizable o uno nuevo — ver
  nota abajo), crea `Sale` + `SaleItem[]`, calcula `total`. Devuelve
  `{ ok: true, saleId, number } | { ok: false, error }`. `revalidatePath('/deposito')`
  y `revalidatePath('/ventas')`.
- `cancelSale(id)`: `requireRole(['ADMIN', 'VENDEDOR'])`. Dentro de una
  transacción: si ya estaba anulada, error. Por cada `SaleItem`, repone
  stock (`InventoryStock.quantity += item.quantity`) y crea un
  `InventoryTransaction` (`type: 'ANULACION'`, delta positivo). Marca
  `Sale.cancelledAt/cancelledById`. `revalidatePath('/deposito')` y
  `revalidatePath('/ventas')`.

**Nota sobre `InventoryTransaction.batchId`:** hoy es `String? @db.Uuid`
pensado para agrupar movimientos de una misma carga por lote. Se reutiliza
tal cual para agrupar los movimientos `VENTA`/`ANULACION` de una misma venta
(`batchId = sale.id`) — evita agregar una columna `saleId` redundante en
`InventoryTransaction` solo para poder "ver todos los movimientos de esta
venta" (ya se puede vía `batchId`).

## Pantallas

**`/ventas/nueva`** (`src/app/(app)/ventas/nueva/page.tsx` + `SaleCart.tsx`
client): buscador (llama `searchSellableVariants` vía Server Action, sin
necesidad de recrear la ruta `/api/search` que se había borrado — Next 16
permite invocar Server Actions directo desde el cliente), lista de
resultados con stock visible, click agrega al carrito (si ya está en el
carrito, suma cantidad en vez de duplicar fila); cada fila del carrito
tiene cantidad editable (reusa `QuantityStepper`) y un botón para quitarla;
total en vivo (`money()`); `<select>` de método de pago; "Confirmar venta"
llama `createSale` — si `ok`, redirige a `/ventas/[id]` (que dispara la
impresión, ver abajo); si falla por stock insuficiente, muestra el error
sin perder el carrito cargado.

**`/ventas`** (`src/app/(app)/ventas/page.tsx`): tabla (patrón
`ProductList`/`StockList`: `≥ md` tabla, `< md` tarjetas) con número,
fecha/hora, vendedora, método de pago, total, estado (Anulada en rojo si
corresponde); fila lleva a `/ventas/[id]`. Botón "+ Nueva venta" arriba.

**`/ventas/[id]`** (`src/app/(app)/ventas/[id]/page.tsx`): el comprobante
en sí — encabezado con nombre del negocio (reusa `public/logo.png`), "Ticket
N° {number}", fecha, vendedora, tabla de ítems (producto · variante,
cantidad, precio unitario, subtotal), total, método de pago, y el aviso
**"Documento no válido como factura"**. Botón "Imprimir" (`window.print()`)
visible en pantalla pero oculto en el propio print vía `print:hidden`; si
`!cancelledAt` y el usuario tiene permiso, botón "Anular venta" con
confirmación. CSS `@media print` en este componente puntual (no global)
oculta el `Header`/`Sidebar` del layout — igual que im`Dialog` ya maneja
capas hoy, acá se agrega una clase utilitaria `print:hidden` en
`Header`/`Sidebar`/el botón de acciones, y la página de comprobante en sí
usa `print:p-0` para que ocupe toda la hoja.

**Auto-impresión:** `SaleCart` redirige a `/ventas/[id]?justCreated=1` tras
`createSale`; la página de comprobante, si ve ese query param, dispara
`window.print()` en un `useEffect` al montar (client component chico que
envuelve el comprobante) y limpia el param de la URL con
`router.replace` para que un F5 posterior no vuelva a abrir el diálogo.

## Comprobante — contenido exacto

```
[logo]
Jael Castillo — Todo para tu Hogar
Ticket N° 42                       22/09/2026 18:30
Vendedora: Ana

Producto · Variante          Cant.   P. unit.   Subtotal
Sillón Milán · 2 cuerpos       1     $45.000     $45.000
Mesa Ratona · Única             2     $12.000     $24.000
                                          Total:  $69.000

Método de pago: Efectivo

Documento no válido como factura.
```

## Manejo de errores

| Caso | Mensaje |
|---|---|
| Carrito vacío al confirmar | "Agregá al menos un producto" (validación de zod) |
| Cantidad sin método de pago | "Elegí un método de pago" |
| Stock insuficiente en algún ítem | "No hay stock suficiente de {producto · variante} (quedan N)" — aborta toda la venta |
| Anular una venta ya anulada | "Esta venta ya fue anulada" |
| Rol sin permiso (`DEPOSITO` intentando `/ventas`) | Redirect a `/productos` (mismo patrón que `requireRole` hoy) |

## Testing

Sigue las convenciones ya establecidas (acciones/queries contra la base de
test de Docker vía `src/test/db.ts`; componentes con RTL):

- `src/server/actions/sales.test.ts`: venta exitosa (descuenta stock, crea
  `InventoryTransaction` tipo `VENTA` con el `batchId` de la venta, calcula
  `total` bien con precio efectivo variante/producto), rechazo por stock
  insuficiente (no persiste nada — verificar que el stock no cambió), anulación
  exitosa (repone stock, tipo `ANULACION`), anulación de venta ya anulada
  (error).
- `src/server/queries/sales.test.ts`: `searchSellableVariants` (incluye
  stock, respeta el mínimo de 2 caracteres como el resto de las búsquedas),
  `listSales`/`getSale`.
- `src/server/auth/guards.test.ts`: `requireRole` con array de roles
  (nuevo caso, además de los existentes con string).
- Componentes: `SaleCart` (agregar al carrito, sumar cantidad si ya está,
  confirmar llama `createSale`, error de stock no vacía el carrito),
  `navItems.ts` (rol `VENDEDOR` ve "Ventas" pero no "Usuarios"; `DEPOSITO`
  no ve "Ventas").

## Fuera de alcance (explícitamente, para esta iteración)

Ya cubierto arriba en "Alcance" — se repite el más importante por claridad:
**esto no genera ninguna factura fiscal ni se comunica con AFIP/ARCA en
absoluto.** Si en el futuro se necesita facturación real, es un trabajo
aparte (CUIT, punto de venta habilitado, certificado digital, Web Service
de Facturación Electrónica) que no reutiliza este comprobante interno más
que como base conceptual.
