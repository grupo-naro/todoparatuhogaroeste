# Catálogo público sin precio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar una ruta pública `/catalogo` (sin login) que muestre los productos con sus fotos y variantes, sin precio en ningún lado, con un botón "Consultar por WhatsApp" por variante.

**Architecture:** Una función pura arma el link de WhatsApp. Una query nueva y aislada (la única del proyecto sin guard de auth) trae del catálogo solo los campos seguros de mostrar. Componentes de UI puramente presentacionales arman la grilla. La página cuelga fuera del grupo `(app)` (que exige sesión) y el middleware la suma a su lista de rutas públicas.

**Tech Stack:** Next.js 16 App Router (Server Component sin guard), Prisma 7, Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-26-catalogo-publico-design.md`

## Global Constraints

- `/catalogo` es pública — ningún archivo de este plan llama a `requireUser`/`requireRole` en ningún lado.
- La query del catálogo (`listPublicCatalog`) nunca puede seleccionar `price`, `cost` ni `defaultPrice` — siempre `select` explícito por campo, nunca `include` (que traería el modelo completo). Task 2 lo prueba con un test dedicado que inspecciona las keys del objeto devuelto.
- El stock se muestra siempre como booleano (`disponible`) — nunca la cantidad exacta, en ningún componente.
- Una variante sin fila de `InventoryStock` cuenta como no disponible (`stock?.quantity ?? 0 > 0`), mismo criterio ya usado en el trabajo de Dashboards.
- `variant.name` ya es la combinación de medida/tela/color (armada por `variantDisplayName` al cargar el producto, `src/lib/pricing.ts`) — no se reconstruye aparte en ningún lado de este plan.
- Número de WhatsApp fijo: `5491126039383`.
- Cada commit termina con: `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

## Review Focus

- El precio no debe aparecer en ningún lado del catálogo público — ni en la respuesta de la query, ni en el HTML renderizado. Task 2 lo prueba explícitamente sobre las keys del objeto; el reviewer de cada task que toque estos archivos debe además `grep` por `price`/`cost`/`defaultPrice` en los archivos nuevos como chequeo extra.
- `/catalogo` tiene que ser alcanzable sin sesión — ningún archivo nuevo de este plan importa `requireUser`/`requireRole`. Cubierto en Task 4.
- Una variante nunca estockeada se ve como agotada, no como disponible por default (un `?? 0` mal puesto invertiría esto silenciosamente). Cubierto en Task 2.
- El link de WhatsApp apunta exactamente al número correcto, con el texto bien codificado — un error acá manda el mensaje a un número equivocado. Cubierto en Task 1, reverificado por integración (no reconstruyendo el string a mano) en Task 3.
- Un producto sin fotos no debe romper el render ni mostrar un ícono roto de `next/image` — tiene que caer al placeholder. Cubierto en Task 3.

---

### Task 1: Link de WhatsApp — `src/lib/whatsapp.ts`

**Files:**
- Create: `src/lib/whatsapp.ts`
- Test: `src/lib/whatsapp.test.ts`

**Interfaces:**
- Consumes: nada (función pura, sin dependencias del proyecto).
- Produces: `export function buildWhatsappLink(productName: string, variantName: string): string`.

- [ ] **Step 1: Test que falla — `src/lib/whatsapp.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { buildWhatsappLink } from './whatsapp'

describe('buildWhatsappLink', () => {
  it('arma la URL con el número fijo y el texto esperado, codificado', () => {
    const url = buildWhatsappLink('Sillón Milán', '2 cuerpos · Tela A · Azul')
    expect(url).toBe(
      'https://wa.me/5491126039383?text=' +
      encodeURIComponent('Hola! Quiero consultar por Sillón Milán (2 cuerpos · Tela A · Azul)'),
    )
  })

  it('codifica tildes, espacios y paréntesis correctamente', () => {
    const url = buildWhatsappLink('Ropero a medida', 'Única')
    expect(url).toContain('Ropero%20a%20medida')
    expect(url).toContain('%C3%9Anica') // "Única" con Ú codificada
    expect(url).toContain('%28') // (
    expect(url).toContain('%29') // )
  })
})
```

- [ ] **Step 2: Ejecutar — debe fallar.** Run: `pnpm test src/lib/whatsapp.test.ts` → FAIL (`whatsapp.ts` no existe).

- [ ] **Step 3: Implementar `src/lib/whatsapp.ts`**

```ts
export function buildWhatsappLink(productName: string, variantName: string): string {
  const text = `Hola! Quiero consultar por ${productName} (${variantName})`
  return `https://wa.me/5491126039383?text=${encodeURIComponent(text)}`
}
```

- [ ] **Step 4: Ejecutar — debe pasar.** Run: `pnpm test src/lib/whatsapp.test.ts` → PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/whatsapp.ts src/lib/whatsapp.test.ts
git commit -m "feat: buildWhatsappLink arma el link de consulta por producto y variante"
```

---

### Task 2: Query pública del catálogo — `src/server/queries/catalog.ts`

**Files:**
- Create: `src/server/queries/catalog.ts`
- Test: `src/server/queries/catalog.test.ts`

**Interfaces:**
- Consumes: `prisma` (`@/server/db`, ya existe).
- Produces: `export type PublicCatalogVariant = { id: string; name: string; disponible: boolean }`; `export type PublicCatalogProduct = { id: string; name: string; images: { url: string }[]; variants: PublicCatalogVariant[] }`; `export async function listPublicCatalog(categoryId?: string): Promise<PublicCatalogProduct[]>`.

- [ ] **Step 1: Test que falla — `src/server/queries/catalog.test.ts`**

```ts
import { describe, expect, it, beforeEach } from 'vitest'
import { prisma, resetDb } from '@/test/db'
import { listPublicCatalog } from './catalog'

let categoryId: string

beforeEach(async () => {
  await resetDb()
  const c = await prisma.category.create({ data: { name: 'Sillones', slug: 'sillones' } })
  categoryId = c.id
})

describe('listPublicCatalog', () => {
  it('nunca incluye price, cost ni defaultPrice en la respuesta', async () => {
    await prisma.product.create({
      data: {
        name: 'Sillón Milán', categoryId, defaultPrice: 500, defaultCost: 300,
        variants: { create: [{ name: '2 cuerpos', price: 550, cost: 320 }] },
      },
    })
    const rows = await listPublicCatalog()
    expect(Object.keys(rows[0])).not.toContain('price')
    expect(Object.keys(rows[0])).not.toContain('cost')
    expect(Object.keys(rows[0])).not.toContain('defaultPrice')
    expect(Object.keys(rows[0].variants[0])).not.toContain('price')
    expect(Object.keys(rows[0].variants[0])).not.toContain('cost')
  })

  it('disponible es true con stock, false con stock en cero, false sin fila de stock', async () => {
    const p = await prisma.product.create({
      data: {
        name: 'Sillón Milán', categoryId, defaultPrice: 500,
        variants: { create: [
          { name: 'Con stock', price: 500 },
          { name: 'Sin stock', price: 500 },
          { name: 'Nunca stockeada', price: 500 },
        ] },
      },
      include: { variants: true },
    })
    const byName = Object.fromEntries(p.variants.map((v) => [v.name, v.id]))
    await prisma.inventoryStock.create({ data: { variantId: byName['Con stock'], quantity: 5 } })
    await prisma.inventoryStock.create({ data: { variantId: byName['Sin stock'], quantity: 0 } })

    const rows = await listPublicCatalog()
    const disponibleByName = Object.fromEntries(rows[0].variants.map((v) => [v.name, v.disponible]))
    expect(disponibleByName['Con stock']).toBe(true)
    expect(disponibleByName['Sin stock']).toBe(false)
    expect(disponibleByName['Nunca stockeada']).toBe(false)
  })

  it('filtra por categoryId cuando se pasa', async () => {
    const c2 = await prisma.category.create({ data: { name: 'Mesas', slug: 'mesas' } })
    await prisma.product.create({ data: { name: 'Sillón Milán', categoryId, defaultPrice: 500, variants: { create: [{ name: 'A', price: 500 }] } } })
    await prisma.product.create({ data: { name: 'Mesa Roble', categoryId: c2.id, defaultPrice: 800, variants: { create: [{ name: 'A', price: 800 }] } } })

    const rows = await listPublicCatalog(categoryId)
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('Sillón Milán')
  })

  it('sin categoryId trae productos de todas las categorías', async () => {
    const c2 = await prisma.category.create({ data: { name: 'Mesas', slug: 'mesas' } })
    await prisma.product.create({ data: { name: 'Sillón Milán', categoryId, defaultPrice: 500, variants: { create: [{ name: 'A', price: 500 }] } } })
    await prisma.product.create({ data: { name: 'Mesa Roble', categoryId: c2.id, defaultPrice: 800, variants: { create: [{ name: 'A', price: 800 }] } } })

    const rows = await listPublicCatalog()
    expect(rows).toHaveLength(2)
  })

  it('un producto sin fotos devuelve un array de imágenes vacío, sin romper', async () => {
    await prisma.product.create({ data: { name: 'Sillón Milán', categoryId, defaultPrice: 500, variants: { create: [{ name: 'A', price: 500 }] } } })
    const rows = await listPublicCatalog()
    expect(rows[0].images).toEqual([])
  })
})
```

- [ ] **Step 2: Ejecutar — debe fallar.** Run: `pnpm test src/server/queries/catalog.test.ts` → FAIL (`catalog.ts` no existe). Requiere la base de test de Docker levantada (`pnpm run test:db:up` si no lo está).

- [ ] **Step 3: Implementar `src/server/queries/catalog.ts`**

```ts
import 'server-only'
import { prisma } from '@/server/db'

export type PublicCatalogVariant = { id: string; name: string; disponible: boolean }

export type PublicCatalogProduct = {
  id: string; name: string
  images: { url: string }[]
  variants: PublicCatalogVariant[]
}

export async function listPublicCatalog(categoryId?: string): Promise<PublicCatalogProduct[]> {
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
}
```

- [ ] **Step 4: Ejecutar — debe pasar.** Run: `pnpm test src/server/queries/catalog.test.ts` → PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/server/queries/catalog.ts src/server/queries/catalog.test.ts
git commit -m "feat: listPublicCatalog trae productos/variantes sin precio para el catálogo público"
```

---

### Task 3: Componentes del catálogo

**Files:**
- Create: `src/components/catalogo/CategoryFilter.tsx`
- Test: `src/components/catalogo/CategoryFilter.test.tsx`
- Create: `src/components/catalogo/ProductCard.tsx`
- Test: `src/components/catalogo/ProductCard.test.tsx`
- Create: `src/components/catalogo/ProductGrid.tsx`
- Test: `src/components/catalogo/ProductGrid.test.tsx`

**Interfaces:**
- Consumes: `buildWhatsappLink` (Task 1, `@/lib/whatsapp`); `PublicCatalogProduct` (Task 2, `@/server/queries/catalog`).
- Produces: `<CategoryFilter categories={{value,label}[]} />`; `<ProductCard product={PublicCatalogProduct} />`; `<ProductGrid products={PublicCatalogProduct[]} />`.

**Nota sobre el `<select>` de categoría:** este proyecto ya tiene un componente `<Select>` (Radix) para selects estilizados, pero ningún test existente en todo el código interactúa con él seleccionando una opción — los tres archivos que lo usan (`StockFilters`, `SaleCart`, `ProductFilters`) solo verifican presencia/ausencia, nunca hacen click y eligen una opción. Por eso `CategoryFilter` usa un `<select>` nativo (mismo patrón ya probado en `StockFilters.tsx` para su campo "Estado", con `userEvent.selectOptions` funcionando ahí) — así el test de este componente puede probar la interacción real, no solo que el campo existe.

- [ ] **Step 1: Test que falla — `src/components/catalogo/CategoryFilter.test.tsx`**

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/catalogo',
  useSearchParams: () => new URLSearchParams(''),
}))
import { CategoryFilter } from './CategoryFilter'

const categories = [{ value: 'c1', label: 'Sillones' }, { value: 'c2', label: 'Mesas' }]

describe('CategoryFilter', () => {
  it('empuja ?categoria= al elegir una categoría', async () => {
    render(<CategoryFilter categories={categories} />)
    await userEvent.selectOptions(screen.getByLabelText('Categoría'), 'c1')
    expect(push).toHaveBeenCalledWith(expect.stringContaining('categoria=c1'))
  })
})
```

- [ ] **Step 2: Ejecutar — debe fallar.** Run: `pnpm test src/components/catalogo/CategoryFilter.test.tsx` → FAIL.

- [ ] **Step 3: Implementar `src/components/catalogo/CategoryFilter.tsx`**

```tsx
'use client'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

export function CategoryFilter({ categories }: { categories: { value: string; label: string }[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const selected = searchParams.get('categoria') ?? ''

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set('categoria', value)
    else params.delete('categoria')
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="mb-4 max-w-xs">
      <label className="flex flex-col gap-1">
        <span className="text-sm">Categoría</span>
        <select value={selected} onChange={handleChange} aria-label="Categoría"
          className="w-full border border-border rounded px-3 min-h-11 text-base md:text-sm bg-transparent">
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </label>
    </div>
  )
}
```

- [ ] **Step 4: Ejecutar — debe pasar.** Run: `pnpm test src/components/catalogo/CategoryFilter.test.tsx` → PASS.

- [ ] **Step 5: Test que falla — `src/components/catalogo/ProductCard.test.tsx`**

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProductCard } from './ProductCard'
import { buildWhatsappLink } from '@/lib/whatsapp'
import type { PublicCatalogProduct } from '@/server/queries/catalog'

const product: PublicCatalogProduct = {
  id: 'p1', name: 'Sillón Milán',
  images: [{ url: 'https://example.com/foto.jpg' }],
  variants: [
    { id: 'v1', name: '2 cuerpos', disponible: true },
    { id: 'v2', name: '3 cuerpos', disponible: false },
  ],
}

describe('ProductCard', () => {
  it('muestra el nombre del producto y de cada variante', () => {
    render(<ProductCard product={product} />)
    expect(screen.getByText('Sillón Milán')).toBeInTheDocument()
    expect(screen.getByText('2 cuerpos')).toBeInTheDocument()
    expect(screen.getByText('3 cuerpos')).toBeInTheDocument()
  })

  it('muestra "Agotado" solo en la variante sin stock', () => {
    render(<ProductCard product={product} />)
    expect(screen.getAllByText('Agotado')).toHaveLength(1)
  })

  it('el link de WhatsApp de cada variante usa buildWhatsappLink con el producto y esa variante', () => {
    render(<ProductCard product={product} />)
    const links = screen.getAllByRole('link', { name: 'Consultar por WhatsApp' })
    expect(links[0]).toHaveAttribute('href', buildWhatsappLink('Sillón Milán', '2 cuerpos'))
    expect(links[1]).toHaveAttribute('href', buildWhatsappLink('Sillón Milán', '3 cuerpos'))
  })

  it('sin fotos, no renderiza ninguna imagen (muestra el placeholder)', () => {
    render(<ProductCard product={{ ...product, images: [] }} />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 6: Ejecutar — debe fallar.** Run: `pnpm test src/components/catalogo/ProductCard.test.tsx` → FAIL.

- [ ] **Step 7: Implementar `src/components/catalogo/ProductCard.tsx`**

```tsx
import Image from 'next/image'
import { ImageOff } from 'lucide-react'
import { buildWhatsappLink } from '@/lib/whatsapp'
import type { PublicCatalogProduct } from '@/server/queries/catalog'

export function ProductCard({ product }: { product: PublicCatalogProduct }) {
  const firstImage = product.images[0]
  return (
    <article className="border border-border rounded-lg p-3 flex flex-col gap-3">
      <div className="relative aspect-square overflow-hidden rounded bg-border/30">
        {firstImage ? (
          <Image src={firstImage.url} alt={product.name} fill className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-muted">
            <ImageOff className="size-8" />
          </div>
        )}
      </div>
      <h3 className="font-medium">{product.name}</h3>
      <ul className="flex flex-col gap-2">
        {product.variants.map((v) => (
          <li key={v.id} className="flex items-center justify-between gap-2 border-t border-border pt-2">
            <span className="text-sm">
              {v.name}
              {!v.disponible && <span className="ml-2 text-danger text-xs font-medium">Agotado</span>}
            </span>
            <a href={buildWhatsappLink(product.name, v.name)} target="_blank" rel="noopener noreferrer"
              className="text-xs underline whitespace-nowrap">Consultar por WhatsApp</a>
          </li>
        ))}
      </ul>
    </article>
  )
}
```

- [ ] **Step 8: Ejecutar — debe pasar.** Run: `pnpm test src/components/catalogo/ProductCard.test.tsx` → PASS (4 tests).

- [ ] **Step 9: Test que falla — `src/components/catalogo/ProductGrid.test.tsx`**

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProductGrid } from './ProductGrid'
import type { PublicCatalogProduct } from '@/server/queries/catalog'

describe('ProductGrid', () => {
  it('muestra una tarjeta por producto', () => {
    const products: PublicCatalogProduct[] = [
      { id: 'p1', name: 'Sillón Milán', images: [], variants: [{ id: 'v1', name: 'A', disponible: true }] },
      { id: 'p2', name: 'Mesa Roble', images: [], variants: [{ id: 'v2', name: 'A', disponible: true }] },
    ]
    render(<ProductGrid products={products} />)
    expect(screen.getByText('Sillón Milán')).toBeInTheDocument()
    expect(screen.getByText('Mesa Roble')).toBeInTheDocument()
  })

  it('sin productos, muestra el mensaje de categoría vacía', () => {
    render(<ProductGrid products={[]} />)
    expect(screen.getByText('No hay productos en esta categoría')).toBeInTheDocument()
  })
})
```

- [ ] **Step 10: Ejecutar — debe fallar.** Run: `pnpm test src/components/catalogo/ProductGrid.test.tsx` → FAIL.

- [ ] **Step 11: Implementar `src/components/catalogo/ProductGrid.tsx`**

```tsx
import type { PublicCatalogProduct } from '@/server/queries/catalog'
import { ProductCard } from './ProductCard'

export function ProductGrid({ products }: { products: PublicCatalogProduct[] }) {
  if (products.length === 0) {
    return <p className="text-center text-muted py-8">No hay productos en esta categoría</p>
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((p) => <ProductCard key={p.id} product={p} />)}
    </div>
  )
}
```

- [ ] **Step 12: Ejecutar — debe pasar.** Run: `pnpm test src/components/catalogo/ProductGrid.test.tsx` → PASS (2 tests).

- [ ] **Step 13: Commit**

```bash
git add src/components/catalogo
git commit -m "feat: componentes del catálogo público (filtro de categoría, tarjeta, grilla)"
```

---

### Task 4: Página `/catalogo` y middleware

**Files:**
- Create: `src/app/catalogo/layout.tsx`
- Create: `src/app/catalogo/page.tsx`
- Modify: `src/proxy.ts`

**Interfaces:**
- Consumes: `listPublicCatalog` (Task 2, `@/server/queries/catalog`); `listCategoryOptions` (`@/server/queries/categories`, ya existe); `CategoryFilter`, `ProductGrid` (Task 3, `@/components/catalogo`).
- Produces: sin interfaz pública nueva — es la página final.

- [ ] **Step 1: Implementar `src/app/catalogo/layout.tsx`**

```tsx
import Image from 'next/image'

export default function CatalogoLayout({ children }: LayoutProps<'/catalogo'>) {
  return (
    <div className="min-h-full flex flex-col">
      <header className="h-14 border-b border-border flex items-center gap-3 px-4">
        <Image src="/logo.png" alt="Jael Castillo — Todo para tu Hogar" width={36} height={36} className="rounded-full shrink-0" priority />
        <span className="font-semibold">Jael Castillo — Todo para tu Hogar</span>
      </header>
      <main className="flex-1 p-4 sm:p-6">{children}</main>
    </div>
  )
}
```

- [ ] **Step 2: Implementar `src/app/catalogo/page.tsx`**

```tsx
import { listPublicCatalog } from '@/server/queries/catalog'
import { listCategoryOptions } from '@/server/queries/categories'
import { CategoryFilter } from '@/components/catalogo/CategoryFilter'
import { ProductGrid } from '@/components/catalogo/ProductGrid'

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
      <h1 className="text-xl font-semibold mb-4">Catálogo</h1>
      <CategoryFilter categories={categories} />
      <ProductGrid products={products} />
    </section>
  )
}
```

- [ ] **Step 3: Editar `src/proxy.ts`**

Cambiar:

```ts
const PUBLIC_PATHS = ['/login', '/api/health']
```

a:

```ts
const PUBLIC_PATHS = ['/login', '/api/health', '/catalogo']
```

(el resto del archivo queda exactamente igual — el matcheo `pathname === p || pathname.startsWith(p + '/')` ya cubre `/catalogo` y cualquier subruta futura bajo `/catalogo/`).

- [ ] **Step 4: Verificar la suite completa y el build**

```bash
pnpm test
pnpm exec tsc --noEmit
pnpm exec eslint .
pnpm build
```

Verificar además, manualmente, que `/catalogo` aparece en la salida de `pnpm build` como una ruta propia (no bajo el layout de `(app)`), y que ninguno de los 3 archivos de este task importa `requireUser`/`requireRole` en ningún lado (chequeo explícito porque este es el único conjunto de archivos de todo el proyecto donde eso es intencional).

- [ ] **Step 5: Commit**

```bash
git add src/app/catalogo src/proxy.ts
git commit -m "feat: pagina /catalogo publica, sin login, con filtro por categoria"
```
