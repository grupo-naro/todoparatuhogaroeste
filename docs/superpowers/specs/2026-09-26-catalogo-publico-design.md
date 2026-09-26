# Catálogo público sin precio

## Contexto y objetivo

Hoy toda la app está detrás de login (`proxy.ts` redirige a `/login` a
cualquiera sin sesión). Se necesita una vista pública, sin login, donde
cualquiera pueda ver los productos con sus fotos y variantes (medida/tela/
color) — **sin precio en ningún lado** — y consultar por WhatsApp en vez de
poder comprar directamente.

## Alcance

### Dentro de alcance

1. Ruta pública `/catalogo`, accesible sin sesión.
2. Selector de categoría arriba (reutiliza las categorías ya existentes),
   debajo una grilla de tarjetas por producto.
3. Cada tarjeta de producto: sus fotos (las mismas para todas sus
   variantes — no hay fotos por variante en esta iteración), nombre, y
   debajo la lista de sus variantes con un botón "Consultar por WhatsApp"
   por variante.
4. Variantes sin stock se muestran igual, con un badge "Agotado" (sin
   mostrar la cantidad exacta en ningún caso).
5. Productos sin fotos se muestran igual, con un placeholder genérico.
6. El botón de WhatsApp abre `https://wa.me/5491126039383` con un mensaje
   precargado: `Hola! Quiero consultar por {producto} ({variante})`.
7. `title`/`description` (metadata) propios de la página, para que
   compartir el link por WhatsApp muestre una vista previa decente.

### Fuera de alcance (esta iteración)

Fotos por variante (requeriría cambio de schema — evaluado y descartado
para esta iteración), página de detalle por producto, búsqueda por texto,
cualquier forma de compra/carrito/checkout desde el catálogo público,
precios en cualquier forma (ni exactos ni "desde $X"), mostrar la cantidad
exacta de stock, campo para marcar productos como "públicos"/"ocultos"
(se muestran todos), tests de middleware para `proxy.ts` (el archivo no
tiene tests hoy, no se agrega infraestructura nueva para esto).

## Arquitectura

### Middleware — `src/proxy.ts` (modificado)

`PUBLIC_PATHS` gana `/catalogo`:

```ts
const PUBLIC_PATHS = ['/login', '/api/health', '/catalogo']
```

Mismo criterio de matcheo que ya existe (`pathname === p ||
pathname.startsWith(p + '/')`), así que también cubre cualquier futura
subruta bajo `/catalogo/`.

### Query pública — `src/server/queries/catalog.ts` (nuevo)

La única query de todo el proyecto que **no** pasa por `requireUser`/
`requireRole` — a propósito, porque el catálogo es público. Por eso mismo,
el `select` de Prisma nunca puede traer `price`, `defaultPrice` ni `cost`
en ningún nivel — ni del producto ni de la variante — aunque sea sin
usarlos después: el riesgo no es "olvidarse de no mostrarlo en el JSX",
es que el campo ni siquiera llegue a la respuesta del server.

```ts
export type PublicCatalogVariant = { id: string; name: string; disponible: boolean }
export type PublicCatalogProduct = {
  id: string; name: string
  images: { url: string }[]
  variants: PublicCatalogVariant[]
}

export async function listPublicCatalog(categoryId?: string): Promise<PublicCatalogProduct[]>
```

Implementación (Prisma):

```ts
const products = await prisma.product.findMany({
  where: categoryId ? { categoryId } : undefined,
  select: {
    id: true,
    name: true,
    images: { select: { url: true }, orderBy: { order: 'asc' } },
    variants: {
      select: { id: true, name: true, stock: { select: { quantity: true } } },
    },
  },
  orderBy: { name: 'asc' },
})

return products.map((p) => ({
  id: p.id,
  name: p.name,
  images: p.images,
  variants: p.variants.map((v) => ({
    id: v.id, name: v.name, disponible: (v.stock?.quantity ?? 0) > 0,
  })),
}))
```

Nótese el `select` explícito a nivel `product` y a nivel `variant` — nunca
`include`, que traería el modelo completo (con `defaultPrice`/`cost`/
`price` incluidos) por accidente. Una variante sin fila de `InventoryStock`
cuenta como no disponible (`v.stock?.quantity ?? 0`), mismo criterio que
ya se usó en el trabajo de Dashboards.

Categorías: reutiliza `listCategoryOptions()` (`src/server/queries/
categories.ts`, ya existe) tal cual — no expone precio en ningún lado.

### Página — `src/app/catalogo/page.tsx` (nuevo, fuera del grupo `(app)`)

`(app)/layout.tsx` exige sesión (`requireUser()`) — por eso esta ruta no
puede vivir ahí. `/catalogo` cuelga directo de `src/app/`, hereda
únicamente el layout raíz (fuentes, `<html>`/`<body>`), y define su propio
layout mínimo.

```
src/app/catalogo/
  layout.tsx    -- header simple: logo + nombre del negocio, sin sidebar
  page.tsx      -- server component: lee categoría de ?categoria=, llama
                   listPublicCatalog + listCategoryOptions, arma metadata
```

`page.tsx` (server component, sin guard):

```tsx
export const metadata = {
  title: 'Catálogo — Jael Castillo · Todo para tu Hogar',
  description: 'Mirá nuestros productos y consultá por WhatsApp.',
}

export default async function CatalogoPage({ searchParams }: { searchParams: Promise<{ categoria?: string }> }) {
  const sp = await searchParams
  const [products, categories] = await Promise.all([
    listPublicCatalog(sp.categoria || undefined),
    listCategoryOptions(),
  ])
  return (
    <section>
      <CategoryFilter categories={categories} selected={sp.categoria} />
      <ProductGrid products={products} />
    </section>
  )
}
```

`CategoryFilter` es un `<Select>` cliente que empuja `?categoria=` a la
URL, mismo patrón que `StockFilters` en `/deposito` (pero solo esa una
opción — sin búsqueda por texto ni estado, fuera de alcance). Recibe
`categories: { value: string; label: string }[]` — el shape exacto que ya
devuelve `listCategoryOptions()` (`src/server/queries/categories.ts:12`,
`value` = id de la categoría, `label` = nombre), sin transformación
intermedia.

`ProductGrid`/`ProductCard`: grilla responsiva (`grid-cols-1 sm:grid-cols-2
lg:grid-cols-3`, sin el patrón dual-DOM tabla/tarjetas que usan las
pantallas de datos administrativas — acá no hay una tabla que mostrar,
son tarjetas visuales desde el vamos). Cada tarjeta:

- Primera foto del producto (o un placeholder genérico si `images` está
  vacío) — la galería completa no es necesaria para esta iteración, YAGNI.
- Nombre del producto.
- Por cada variante: su `name`, un badge "Agotado" si `!disponible`, y un
  link "Consultar por WhatsApp".

### Link de WhatsApp

Función pura, sin estado ni Server Action:

```ts
export function buildWhatsappLink(productName: string, variantName: string): string {
  const text = `Hola! Quiero consultar por ${productName} (${variantName})`
  return `https://wa.me/5491126039383?text=${encodeURIComponent(text)}`
}
```

Renderizado como `<a href={buildWhatsappLink(...)} target="_blank"
rel="noopener noreferrer">Consultar por WhatsApp</a>` — no es un botón que
dispare nada del lado del servidor, es un link directo.

## Manejo de errores / casos límite

| Caso | Comportamiento |
|---|---|
| Categoría sin productos | `ProductGrid` muestra "No hay productos en esta categoría" |
| Producto sin fotos (`images` vacío) | Placeholder genérico en vez de `<img>` |
| Producto sin variantes | Se muestra la tarjeta sin ninguna fila de variante debajo (no debería pasar en la práctica, pero no rompe) |
| Todas las variantes de un producto agotadas | Se muestran igual con su badge, el link de WhatsApp sigue disponible |
| Variante nunca tuvo fila de `InventoryStock` | Cuenta como agotada (`?? 0`), mismo criterio que Dashboards |
| `?categoria=` con un id que no existe | `listPublicCatalog` devuelve lista vacía (mismo comportamiento que "categoría sin productos", sin validar el id explícitamente — un `where: { categoryId }` que no matchea ninguna fila ya se comporta así solo) |

## Testing

- `src/server/queries/catalog.test.ts` (nuevo, DB-backed vía `src/test/
  db.ts`): un test dedicado que arma un producto con precio/costo
  cargados y verifica con `expect(Object.keys(...)).not.toContain('price')`
  (y lo mismo para `cost`/`defaultPrice`) que el objeto devuelto por
  `listPublicCatalog` nunca los incluye — esto es lo único que realmente
  garantiza que un `select` ampliado a futuro no filtre precios sin que
  nadie lo note. Además: `disponible: true` con stock > 0, `false` con
  `quantity: 0`, `false` sin fila de `InventoryStock`; filtro por
  `categoryId` trae solo productos de esa categoría; sin `categoryId` trae
  de todas.
- `src/lib/whatsapp.test.ts` (nuevo): `buildWhatsappLink` arma la URL
  esperada, con el texto correctamente codificado (espacios, tildes,
  paréntesis, el separador "·" si aparece en el nombre de una variante).
- Componentes (`ProductGrid`/`ProductCard`, RTL): placeholder cuando no
  hay fotos; badge "Agotado" cuando corresponde y ausente cuando no;
  mensaje de categoría vacía; el link de WhatsApp de cada variante apunta
  a la URL correcta.
- `proxy.ts`: sin test nuevo (el archivo no tiene tests hoy) — la
  verificación es manual, agregando `/catalogo` al array existente sin
  tocar la lógica de matcheo.
