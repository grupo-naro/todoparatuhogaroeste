# Clientes: registro rápido por teléfono en la venta + estadísticas

## Contexto y objetivo

Hoy toda venta es anónima ("consumidor final"). Se necesita poder asociar una
venta a un cliente identificado por su **número de teléfono** (único), con
alta rápida sin salir del flujo de venta, y una pantalla que muestre
estadísticas básicas por cliente (cuántas veces compró, cuánto gastó, si es
recurrente).

**Hallazgo importante que condiciona el modelo de datos:** producción ya
tiene una tabla `Customer` (`id`, `name`, `phone`, `createdAt`, `updatedAt`),
vacía (0 filas), aplicada por una migración (`20260915024819_add_customer`)
que no existe en ningún lado de este repositorio — quedó fuera de git en
algún momento. Como está vacía, no hay riesgo de datos: este trabajo
**adopta esa tabla** (no crea una nueva) y la completa con lo que falta
(`phone` único, vínculo con `Sale`). La migración de esta iteración tiene que
ser idempotente respecto a la tabla en sí (`CREATE TABLE IF NOT EXISTS`),
porque en la base de test/desarrollo la tabla no existe todavía y hay que
crearla ahí, pero en producción sí existe y no hay que tocarla de nuevo.

## Alcance

### Dentro de alcance

1. Modelo `Customer` (adoptado de producción + `phone` único) y
   `Sale.customerId` opcional.
2. En `/ventas/nueva`: campo de teléfono opcional; si al tipearlo coincide
   con un cliente existente, el nombre se autocompleta (solo lectura); si no
   coincide, se habilita un campo para cargar el nombre del cliente nuevo. Al
   confirmar la venta, el cliente nuevo se crea (si corresponde) y se vincula
   a la venta, todo en la misma transacción.
3. Pantalla `/clientes`: listado con nombre, teléfono, cantidad de compras,
   gasto total y una marca "Recurrente" (2 o más compras) — contando solo
   ventas no anuladas.
4. Normalización de teléfono (solo dígitos) para que el mismo número
   ingresado con distinto formato siempre matchee al mismo cliente.

### Fuera de alcance (esta iteración)

Editar o fusionar clientes existentes, borrar clientes, mostrar el nombre
del cliente en el comprobante impreso o en el historial de ventas (no
pedido), exportar/CSV, envío de mensajes/promociones, validación estricta de
formato de teléfono argentino (solo un mínimo de dígitos razonable, no
E.164), página de detalle por cliente con su historial de compras (el
listado con estadísticas alcanza para esta iteración).

## Modelo de datos

`prisma/schema.prisma` — nuevo modelo `Customer` y un campo nuevo en `Sale`:

```prisma
model Customer {
  id        String   @id @default(uuid()) @db.Uuid
  name      String
  phone     String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  sales     Sale[]
}
```

En `Sale`, agregar (después de `paymentMethod`, antes de `total` — no importa
el orden exacto, Prisma no lo exige):

```prisma
  customerId String?   @db.Uuid
  customer   Customer? @relation(fields: [customerId], references: [id], onDelete: SetNull)
```

`onDelete: SetNull` porque no hay ninguna acción que borre un `Customer` en
esta iteración, pero si alguna vez se agrega, una venta vieja no debería
desaparecer ni bloquear el borrado — simplemente queda sin cliente asociado
(mismo espíritu que "las ventas nunca se borran").

**Migración** (hand-written, igual que el resto de las de este proyecto —
`prisma migrate dev` no corre en este entorno):

```sql
-- CreateTable (idempotente: ya existe en producción, no en test/desarrollo)
CREATE TABLE IF NOT EXISTS "Customer" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (ni producción ni test la tienen todavía)
CREATE UNIQUE INDEX IF NOT EXISTS "Customer_phone_key" ON "Customer"("phone");

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN "customerId" UUID;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

## Normalización de teléfono

`src/lib/phone.ts` (nuevo, sin `'server-only'` — se usa tanto en el cliente
para el debounce de búsqueda como en el servidor):

```ts
export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '')
}
```

Se aplica **siempre** antes de leer o escribir `Customer.phone` — tanto en la
búsqueda por teléfono como en `createSale`. "11 2345-6789" y "1123456789"
terminan siendo el mismo cliente.

## Queries — `src/server/queries/customers.ts` (nuevo)

```ts
export async function getCustomerByPhone(rawPhone: string): Promise<{ id: string; name: string; phone: string } | null>
```
Normaliza `rawPhone`, busca por `phone` único, devuelve `null` si no existe o
si el teléfono normalizado queda vacío/demasiado corto (mismo mínimo que la
validación de `createSale`, ver más abajo).

```ts
export type CustomerRow = {
  id: string; name: string; phone: string
  purchaseCount: number; totalSpent: number; isRecurring: boolean
}
export async function listCustomers(): Promise<CustomerRow[]>
```
Trae cada `Customer` con sus `sales` donde `cancelledAt: null` (una venta
anulada no cuenta como compra), calcula `purchaseCount` (cantidad),
`totalSpent` (suma de `total`, convertido con `toNumber()` — nunca devolver
un `Decimal` crudo) e `isRecurring = purchaseCount >= 2`. Orden: por nombre.

## Acciones — `src/server/actions/customers.ts` (nuevo)

```ts
export async function findCustomerByPhoneAction(phone: string): Promise<{ id: string; name: string; phone: string } | null>
```
`requireRole(['ADMIN', 'VENDEDOR'])` + delega a `getCustomerByPhone` — wrapper
invocable directo desde `SaleCart` (Client Component), mismo patrón que
`searchSellableVariantsAction`.

## `createSale` — cambios (`src/server/actions/sales.ts`)

`createSaleSchema` (`src/server/validation/sales.ts`) suma dos campos
opcionales:

```ts
customerPhone: z.string().trim().optional(),
customerName: z.string().trim().optional(),
```

Dentro de `createSale`, **dentro de la misma `$transaction`** que ya arma la
venta, antes de `tx.sale.create`:

- Si `customerPhone` no viene (o normalizado queda vacío): `customerId =
  undefined`, venta anónima como hoy.
- Si viene: normalizar. Si el resultado tiene menos de 6 dígitos, rechazar
  con `'Teléfono inválido'` (mínimo razonable, no valida formato argentino
  específico).
- Buscar `Customer` por ese teléfono normalizado (`tx.customer.findUnique`).
  - Si existe: usar su `id`. **`customerName` se ignora** si vino (no se
    edita el nombre de un cliente existente desde el flujo de venta — fuera
    de alcance).
  - Si no existe: `customerName` (trimeado) es obligatorio — si viene vacío,
    rechazar con `'Ingresá el nombre para registrar al cliente nuevo'`.
    Crear el `Customer` (`tx.customer.create`). Si la creación choca con
    `P2002` (alguien más registró el mismo teléfono en el ínterin — carrera
    de dos ventas simultáneas con un cliente nuevo idéntico), no fallar la
    venta: volver a buscar por teléfono y usar ese `id` en su lugar.
- `tx.sale.create({ data: { ..., customerId } })` — `customerId` puede ser
  `undefined` (Prisma lo trata como "no seteado", queda `null` en la fila).

## Pantalla `/clientes` (nueva)

`src/app/(app)/clientes/page.tsx`: `requireRole(['ADMIN', 'VENDEDOR'])`,
`listCustomers()`, renderiza `<CustomersList>`.

`src/components/clientes/CustomersList.tsx`: mismo patrón dual-DOM que
`SalesList`/`StockList` (`hidden md:block` tabla, `md:hidden` tarjetas).
Columnas/campos: Nombre, Teléfono, Compras (`integer()`), Gasto total
(`money()`), y una marca "Recurrente" (texto o badge) cuando
`isRecurring`. Sin ordenamiento por columna en esta iteración (YAGNI — orden
fijo por nombre, como llega de `listCustomers`).

`src/components/layout/navItems.ts`: nueva entrada `{ href: '/clientes',
label: 'Clientes', icon: Contact, roles: ['ADMIN', 'VENDEDOR'] }` (ícono
`Contact` de `lucide-react`, distinto de `Users` que ya usa "Usuarios").

## `SaleCart` — cambios (`src/components/ventas/SaleCart.tsx`)

Nuevo bloque antes del selector de método de pago:

- `<Input aria-label="Teléfono del cliente (opcional)">`, `inputMode="tel"`.
- Al cambiar (debounce ~300ms, mismo criterio que el buscador de productos),
  si el valor normalizado tiene ≥ 6 dígitos, llama
  `findCustomerByPhoneAction(phone)`.
  - Si devuelve un cliente: mostrar su nombre en un `<Input readOnly>` (o un
    texto simple) con una marca de "cliente encontrado"; no se pide nombre.
  - Si devuelve `null`: mostrar `<Input aria-label="Nombre del cliente">`
    editable para cargar el nombre del cliente nuevo.
  - Si el teléfono queda vacío: ocultar todo el bloque de nombre, venta
    anónima.
- Al confirmar, el payload de `createSale` suma `customerPhone`/`customerName`
  solo si el teléfono tiene contenido (igual que hoy con `items`).

## Manejo de errores

| Caso | Mensaje |
|---|---|
| Teléfono con menos de 6 dígitos tras normalizar | "Teléfono inválido" |
| Teléfono nuevo sin nombre | "Ingresá el nombre para registrar al cliente nuevo" |
| Carrera: mismo teléfono nuevo creado dos veces a la vez | Se resuelve sola (re-busca y vincula), la venta no falla |

## Testing

Sigue las convenciones ya establecidas (queries/acciones contra la base de
test de Docker vía `src/test/db.ts`; componentes con RTL):

- `src/server/queries/customers.test.ts`: `getCustomerByPhone` (encuentra
  normalizando distinto formato, `null` si no existe), `listCustomers`
  (cuenta y suma solo ventas no anuladas, `isRecurring` en el límite exacto
  de 2).
- `src/server/actions/sales.test.ts` (agregar casos a `createSale`): venta
  con teléfono de cliente existente (no crea uno nuevo, usa el `id`);
  teléfono nuevo con nombre (crea el cliente y lo vincula); teléfono nuevo
  sin nombre (rechaza, no persiste nada); venta sin teléfono (sigue
  funcionando igual que antes, `customerId` null).
- Componente: `SaleCart` (tipear un teléfono que matchea autocompleta el
  nombre de solo lectura; uno que no matchea habilita el campo de nombre;
  confirmar con teléfono+nombre nuevos manda ambos campos a `createSale`;
  confirmar sin teléfono no manda ninguno de los dos), `CustomersList`
  (tabla + tarjetas, marca "Recurrente" con 2+ compras, no aparece con 1),
  `navItems.ts` (VENDEDOR ve "Clientes", DEPOSITO no).

## Fuera de alcance (explícitamente, para esta iteración)

Ya cubierto arriba en "Alcance" — el punto más importante: **esta iteración
no permite editar el nombre de un cliente ya existente desde ningún lado**;
si se cargó mal una vez, corregirlo es un trabajo aparte.
