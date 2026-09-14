# Fotos de productos (galería con portada)

## Contexto y objetivo

Hoy `Product`/`ProductVariant` no tienen ningún campo de imagen ni existe
manejo de archivos en el proyecto. Se necesita poder cargar fotos de un
producto desde el sistema de gestión, para que el vendedor pueda
visualizarlas al consultar un producto, y dejar la base preparada para un
futuro catálogo público que reutilice el mismo storage.

Decisiones de alcance ya tomadas:

- Las fotos son **por producto**, no por variante — un producto con varias
  variantes de color/tela sube unas pocas fotos generales, no una serie por
  variante.
- Varias fotos por producto, con **una marcada como portada** (la que se ve
  en el listado).
- Solo **ADMIN** puede subir/reordenar/borrar fotos (igual que el resto de
  la gestión de productos).
- Storage: **Vercel Blob**, con las fotos comprimidas del lado del cliente
  antes de subir (Vercel Blob no transforma imágenes, a diferencia de
  Cloudinary).
- Subida vía **Server Action** (no client-upload directo a Blob): como las
  fotos ya llegan livianas por la compresión previa, no hace falta la
  complejidad extra de un route handler con tokens.

## Modelo de datos

`prisma/schema.prisma`, nuevo modelo `ProductImage`:

```prisma
model ProductImage {
  id        String   @id @default(uuid()) @db.Uuid
  productId String   @db.Uuid
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  url       String
  pathname  String
  order     Int
  createdAt DateTime @default(now())

  @@unique([productId, order])
  @@index([productId])
}
```

Y en `Product`, agregar la relación inversa: `images ProductImage[]`.

- `pathname` guarda la key interna del blob (lo que devuelve `put()` de
  `@vercel/blob` en `pathname`), separado de `url` (la URL pública), porque
  `del()` para borrar necesita esa key.
- `order` define tanto el orden de la galería como la portada: `order = 0`
  es siempre la portada. "Poner como portada" es reordenar, no un campo
  booleano aparte (evita el estado inconsistente de dos portadas a la vez).
- **Nota técnica sobre el `@@unique([productId, order])`:** Postgres no
  difiere esta restricción por default, así que un reorder que reasigna
  `order` a varias filas del mismo producto en una transacción puede
  chocar contra sí mismo a mitad de camino (ej: swap 0↔1 puede intentar
  poner la fila A en `order=1` mientras la fila B todavía tiene `order=1`).
  `reorderProductImages` resuelve esto en dos pasadas dentro de la misma
  transacción: primero mueve las filas afectadas a valores temporales
  negativos (`order = -(posición + 1)`), después las actualiza a sus
  valores finales. `addProductImage` y `deleteProductImage` no tienen este
  problema (asignan/liberan un único valor por vez).
- `onDelete: Cascade` (a diferencia de `Product`→`ProductVariant`, que usa
  `Restrict`): archivar un producto no borra sus filas, pero si alguna vez
  se borra un `Product` de verdad, no tiene sentido dejar huérfanas las
  filas de imágenes — y sus blobs igual quedarían huérfanos en el storage,
  fuera del alcance de esta iteración (ver "Fuera de alcance").
- Sin `archivedAt`: a diferencia de Producto/Variante/Categoría, una foto
  borrada no tiene valor como histórico. Borrar una imagen es **hard
  delete** (fila + blob), no soft delete.

Requiere migración nueva (`prisma migrate dev` en local; `prisma migrate
deploy` en la base real y en la base de test de Docker).

## Storage: Vercel Blob

- Nueva dependencia: `@vercel/blob`.
- Nueva env var: `BLOB_READ_WRITE_TOKEN` (se genera al crear un Blob Store
  en el dashboard de Vercel). Se agrega a `.env.example` (sin valor) y hay
  que pedirle al usuario que la cargue en `.env` y en las env vars del
  proyecto en Vercel.
- `next.config.ts`: agregar `images.remotePatterns` apuntando al host de
  Vercel Blob (`*.public.blob.vercel-storage.com`) para que `next/image`
  pueda servir esas imágenes optimizadas.
- Pathname de cada blob: `products/${productId}/${randomUUID()}.${ext}`
  (evita colisiones, agrupa por producto).

## Compresión en el cliente

Nuevo helper `src/lib/image-compress.ts`: recibe un `File`, lo dibuja en un
`<canvas>` redimensionado (máximo ~1600px en el lado mayor, manteniendo
aspect ratio) y lo re-exporta como JPEG/WebP calidad ~0.8 vía
`canvas.toBlob()`, devolviendo un nuevo `File`. Sin librerías nuevas (Canvas
API es nativa del browser). Se ejecuta en el componente cliente antes de
meter el archivo en el `FormData` que va a la Server Action.

## Server Actions — `src/server/actions/productImages.ts` (nuevo)

Seed de convenciones: mismo patrón que `products.ts` (`'use server'`,
`SaveResult`-like, transacciones, `revalidatePath`), pero con
`requireRole('ADMIN')` en vez de `requireUser()` (mismo guard que ya se usa
para restringir por rol, ver `src/server/auth/guards.ts`).

- `addProductImage(productId: string, formData: FormData): Promise<SaveResult>`
  - `requireRole('ADMIN')`.
  - Extrae el archivo de `formData.get('file')`; valida que sea
    `File`, tipo MIME en `image/jpeg | image/png | image/webp`, y tamaño
    ≤ 5MB (ya viene comprimido del cliente; esto es un tope de seguridad
    del lado servidor, no confiar solo en la validación del cliente).
  - `put(pathname, file, { access: 'public' })`.
  - En una transacción: calcula `order` siguiente
    (`max(order) + 1` entre las imágenes existentes del producto, o `0` si
    no tiene ninguna) y crea la fila `ProductImage`.
  - `revalidatePath('/productos/${productId}')` + `revalidatePath('/productos')`
    (por la miniatura en el listado).
- `deleteProductImage(imageId: string): Promise<SaveResult>`
  - `requireRole('ADMIN')`.
  - Busca la fila (para tener `pathname` y `productId`), `del(pathname)`,
    borra la fila, y en la misma transacción reordena las restantes
    (`order` consecutivo desde 0) para no dejar huecos.
  - Revalida igual que `addProductImage`.
- `reorderProductImages(productId: string, orderedImageIds: string[]): Promise<SaveResult>`
  - `requireRole('ADMIN')`.
  - Valida que `orderedImageIds` sea exactamente el set de ids de imágenes
    actuales del producto (ni de más ni de menos) antes de aplicar.
  - Transacción de dos pasadas (ver nota técnica en "Modelo de datos"):
    primero `order` negativo temporal por fila, después el `order` final
    según la posición en el array. "Hacer portada" desde la UI es un caso
    particular de esto: mover un id a la posición 0.

No hace falta una acción `setCoverImage` separada — se resuelve con
`reorderProductImages`.

## UI

El producto no tiene una pantalla de "detalle" de solo lectura: `/productos/[id]`
ya es la pantalla de edición (`ProductForm mode="edit"`, ver
`src/app/(app)/productos/[id]/page.tsx`), y ahí es donde vive hoy la sección
de variantes existentes. La galería sigue el mismo patrón.

- **`src/server/queries/products.ts`**:
  - `getProduct`: agrega `images: { orderBy: { order: 'asc' } }` al
    `include`.
  - `listProducts`: agrega la portada (`images` filtrado a `order: 0`, o un
    `take: 1, orderBy: { order: 'asc' }`) al `include`, y expone
    `coverImageUrl: string | null` en `ProductRow`.
- **`ProductForm.tsx`** (`mode: 'edit'` únicamente — en alta no hay
  `productId` todavía, igual que las variantes existentes no se pueden
  cargar hasta guardar el producto): nueva sección "Fotos" entre las
  variantes y el botón de archivar, que renderiza `ProductImageGallery`.
  El tipo local `ProductDetail` suma
  `images: Array<{ id: string; url: string; order: number }>`.
- **Nuevo componente `src/components/products/ProductImageGallery.tsx`**
  (Client Component):
  - Input de archivo (`accept="image/*"`) + botón "Agregar foto": al
    elegir, comprime con `image-compress.ts`, arma el `FormData` y llama
    `addProductImage`.
  - Grid de miniaturas (`next/image`) en el orden actual; cada una con
    botón "Eliminar" (confirmación simple, mismo patrón de `useToast` que
    ya usa `ExistingVariantRow`/`archiveVariant`) y botones "◀"/"▶" para
    mover posición (sin librería de drag-and-drop — YAGNI, alcanza con
    mover de a una posición). La miniatura en posición 0 se marca
    visualmente como "Portada".
- **`ProductList.tsx`**: agrega una miniatura chica (`coverImageUrl`) a la
  izquierda del nombre en cada fila/tarjeta; si no hay portada, un
  placeholder genérico (ícono, sin pedir asset nuevo — puede ser un
  `lucide-react` tipo `ImageOff` en un cuadrado con fondo neutro).

## Manejo de errores

| Caso | Mensaje |
|---|---|
| Archivo no es imagen válida (tipo MIME) | "El archivo debe ser una imagen (JPG, PNG o WebP)" |
| Archivo > 5MB tras compresión | "La imagen es demasiado pesada" |
| Falla la subida a Blob (red/servicio) | "No se pudo subir la imagen, probá de nuevo" |
| `reorderProductImages` con set de ids inconsistente | error genérico, no debería ocurrir desde la UI normal (defensivo) |

## Testing

Sigue las convenciones ya establecidas (`src/server/actions/*.test.ts`
contra la base de Docker real vía `src/test/db.ts`; `@vercel/blob` se
mockea, ya que no hay motivo para pegarle a Blob real en tests):

- `productImages.test.ts`: alta (crea fila con `order` correcto, llama
  `put` con los args esperados), rechazo por rol no-ADMIN, rechazo por tipo
  MIME inválido, borrado (llama `del`, reordena las restantes sin huecos),
  reorder (incluye el caso "mover a portada").
- Componente `ProductImageGallery`: agrega imagen (mock de las acciones),
  borra imagen, mueve orden — RTL, mismo estilo que los tests existentes de
  `ProductForm`.
- No se testea `image-compress.ts` con RTL/jsdom real (Canvas API en jsdom
  es limitada/no fiel); se prueba manualmente en el browser. Si hace falta
  cobertura automatizada más adelante, un test de Playwright sería el lugar
  correcto, no unit test.

## Fuera de alcance (explícitamente, para esta iteración)

- Catálogo público (esta iteración solo prepara el modelo/storage para que
  sea reutilizable, no construye la pantalla pública).
- Limpieza de blobs huérfanos si se borra un `Product` directamente de la
  base sin pasar por una acción que también borre sus imágenes primero (no
  existe hoy una acción de borrado físico de producto, solo `archiveProduct`,
  así que el caso no es alcanzable desde la UI).
- Recorte/edición de imagen dentro del sistema (crop, rotar) — la
  compresión en el cliente solo redimensiona, no edita.
- Drag-and-drop real para reordenar (se resuelve con botones ◀/▶ por ahora).
- Límite de cantidad máxima de fotos por producto (no se pidió un tope
  explícito; se puede agregar después si se vuelve un problema real).
