# Fotos de productos (galería con portada) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir subir varias fotos por producto (con una marcada como portada), almacenadas en Vercel Blob, gestionables solo por ADMIN, visibles en el listado y en la pantalla de edición de productos.

**Architecture:** Nuevo modelo `ProductImage` (1:N con `Product`). Tres Server Actions (`addProductImage`, `deleteProductImage`, `reorderProductImages`) suben/borran/reordenan contra Vercel Blob + Postgres en transacciones. Las fotos se comprimen en el browser (Canvas API) antes de subir. Un componente cliente (`ProductImageGallery`) se monta en `ProductForm` (modo edición) y una miniatura de portada se agrega a `ProductList`.

**Tech Stack:** Next.js 16.3.4 (App Router, Server Actions), Prisma 7.10.0 + PostgreSQL (Neon), `@vercel/blob`, React 19 + TypeScript + Zod 4, Tailwind v4, `lucide-react`, Vitest + Testing Library.

**Spec:** [docs/superpowers/specs/2026-09-14-fotos-productos-design.md](../specs/2026-09-14-fotos-productos-design.md)

## Global Constraints

- Fotos por **producto**, no por variante.
- Varias fotos por producto; `order = 0` es siempre la portada (no hay campo booleano separado).
- Solo rol **ADMIN** puede subir/reordenar/borrar (`requireRole('ADMIN')`, `src/server/auth/guards.ts`).
- Storage: **Vercel Blob** (`@vercel/blob`, `put`/`del`), subida vía **Server Action** (no client-upload directo).
- Compresión de imagen en el cliente antes de subir (Canvas API nativa, sin librerías nuevas).
- Tipos de archivo permitidos: `image/jpeg`, `image/png`, `image/webp`. Tope de tamaño: 5MB (post-compresión, validado también en el servidor).
- Borrado de imagen es **hard delete** (fila + blob), no soft delete — sin `archivedAt`.
- `del()` de `@vercel/blob` recibe la **URL** del blob (no el `pathname`); `pathname` se guarda igual como metadata pero no se usa para borrar.
- El reorder completo (`reorderProductImages`) necesita una transacción de **dos pasadas** (valores `order` negativos temporales, después los finales) para no chocar contra `@@unique([productId, order])` a mitad de camino.

---

## Task 1: Modelo de datos, migración y configuración de storage

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/test/db.ts`
- Modify: `.env.example`
- Modify: `next.config.ts`
- Modify: `package.json` (agrega `@vercel/blob`)
- Create: `prisma/migrations/<timestamp>_add_product_image/migration.sql` (generado por Prisma, no se escribe a mano)

**Interfaces:**
- Produces: modelo Prisma `ProductImage { id, productId, url, pathname, order, createdAt }`, relación `Product.images: ProductImage[]`. Env var `BLOB_READ_WRITE_TOKEN`. Todas las tasks siguientes dependen de este modelo existiendo en el cliente Prisma generado.

- [ ] **Step 1: Agregar la dependencia de storage**

```bash
pnpm add @vercel/blob
```

- [ ] **Step 2: Editar el schema de Prisma**

En `prisma/schema.prisma`, agregar `images ProductImage[]` al modelo `Product` (después de `variants`):

```prisma
model Product {
  id           String    @id @default(uuid()) @db.Uuid
  categoryId   String    @db.Uuid
  category     Category  @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  name         String
  description  String?
  defaultCost  Decimal?  @db.Decimal(12, 2)
  defaultPrice Decimal?  @db.Decimal(12, 2)
  archivedAt   DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  variants     ProductVariant[]
  images       ProductImage[]

  @@unique([categoryId, name])
  @@index([categoryId])
}
```

Y agregar el modelo nuevo al final del archivo (después de `InventoryTransaction`):

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

- [ ] **Step 3: Generar y aplicar la migración**

```bash
pnpm exec prisma migrate dev --name add_product_image
```

Esto actualiza `DATABASE_URL`/`DIRECT_URL` (la base real de Neon en `.env`) y regenera el cliente de Prisma. Verificar que el comando termina sin errores y que aparece la carpeta nueva en `prisma/migrations/`.

- [ ] **Step 4: Agregar `ProductImage` al TRUNCATE de la base de test**

En `src/test/db.ts`:

```ts
import { prisma } from '@/server/db'

export { prisma }

export async function resetDb(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "ProductImage","InventoryTransaction","InventoryStock","ProductVariant","Product","Category","User" RESTART IDENTITY CASCADE;',
  )
}
```

- [ ] **Step 5: Agregar la env var de storage al ejemplo**

En `.env.example`, agregar al final:

```
BLOB_READ_WRITE_TOKEN="generar en el dashboard de Vercel al crear un Blob Store"
```

Nota para quien ejecute este plan: hay que crear el Blob Store en Vercel y cargar el token real en `.env` (y en las env vars del proyecto en Vercel) antes de poder probar la subida de fotos manualmente. Los tests automatizados no lo necesitan (mockean `@vercel/blob`, ver Task 2).

- [ ] **Step 6: Configurar el dominio de Vercel Blob en `next/image`**

En `next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
    ],
  },
};

export default nextConfig;
```

- [ ] **Step 7: Aplicar la migración a la base de test y correr la suite existente**

```bash
pnpm test:db:up
pnpm test:db:migrate
pnpm test
```

Expected: todos los tests existentes siguen en verde (esta task no cambia comportamiento todavía, solo el schema y la config).

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/test/db.ts .env.example next.config.ts package.json pnpm-lock.yaml
git commit -m "feat: agrega modelo ProductImage, migración y config de Vercel Blob"
```

---

## Task 2: Server Actions de imágenes de producto

**Files:**
- Create: `src/server/actions/productImages.ts`
- Test: `src/server/actions/productImages.test.ts`

**Interfaces:**
- Consumes: `prisma` (`@/server/db`), `requireRole` (`@/server/auth/guards`), `put`/`del` (`@vercel/blob`), `revalidatePath` (`next/cache`).
- Produces: `addProductImage(productId: string, formData: FormData): Promise<SaveResult>` donde `SaveResult = { ok: true; id: string } | { ok: false; error: string }` (reexporta el tipo ya definido en `src/server/actions/products.ts`); `deleteProductImage(imageId: string): Promise<ActionResult>` y `reorderProductImages(productId: string, orderedImageIds: string[]): Promise<ActionResult>` donde `ActionResult = { ok: true } | { ok: false; error: string }`. Task 5 (`ProductImageGallery`) consume estas tres funciones con estas firmas exactas.

- [ ] **Step 1: Escribir los tests (fallando)**

Crear `src/server/actions/productImages.test.ts`:

```ts
import { describe, expect, it, beforeEach, vi } from 'vitest'
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/server/auth/guards', () => ({
  requireRole: vi.fn().mockResolvedValue({ sub: 'admin1', role: 'ADMIN', name: 'Admin', mustChangePassword: false }),
}))
const { put, del } = vi.hoisted(() => ({
  put: vi.fn(async (pathname: string) => ({ url: `https://blob.example/${pathname}`, pathname })),
  del: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@vercel/blob', () => ({ put, del }))
import { prisma, resetDb } from '@/test/db'
import { addProductImage, deleteProductImage, reorderProductImages } from './productImages'

function fileFormData(name = 'a.jpg', type = 'image/jpeg', size = 1024): FormData {
  const fd = new FormData()
  fd.set('file', new File([new Uint8Array(size)], name, { type }))
  return fd
}

let productId: string
beforeEach(async () => {
  await resetDb()
  const c = await prisma.category.create({ data: { name: 'Mesas', slug: 'mesas' } })
  const p = await prisma.product.create({ data: { name: 'Mesa', categoryId: c.id } })
  productId = p.id
  put.mockClear()
  del.mockClear()
})

describe('addProductImage', () => {
  it('sube el archivo a Blob y crea la fila con order 0 para la primera foto', async () => {
    const res = await addProductImage(productId, fileFormData())
    expect(res.ok).toBe(true)
    expect(put).toHaveBeenCalledWith(
      expect.stringContaining(`products/${productId}/`),
      expect.any(File),
      { access: 'public' },
    )
    const rows = await prisma.productImage.findMany({ where: { productId } })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ order: 0 })
  })

  it('asigna order consecutivo a la segunda foto', async () => {
    await addProductImage(productId, fileFormData('a.jpg'))
    await addProductImage(productId, fileFormData('b.jpg'))
    const rows = await prisma.productImage.findMany({ where: { productId }, orderBy: { order: 'asc' } })
    expect(rows.map((r) => r.order)).toEqual([0, 1])
  })

  it('rechaza un tipo de archivo no permitido', async () => {
    const res = await addProductImage(productId, fileFormData('a.gif', 'image/gif'))
    expect(res).toEqual({ ok: false, error: 'El archivo debe ser una imagen (JPG, PNG o WebP)' })
    expect(put).not.toHaveBeenCalled()
  })

  it('rechaza un archivo demasiado pesado', async () => {
    const res = await addProductImage(productId, fileFormData('a.jpg', 'image/jpeg', 6 * 1024 * 1024))
    expect(res).toEqual({ ok: false, error: 'La imagen es demasiado pesada' })
    expect(put).not.toHaveBeenCalled()
  })

  it('devuelve un error amigable si falla la subida a Blob', async () => {
    put.mockRejectedValueOnce(new Error('network error'))
    const res = await addProductImage(productId, fileFormData())
    expect(res).toEqual({ ok: false, error: 'No se pudo subir la imagen, probá de nuevo' })
    expect(await prisma.productImage.count({ where: { productId } })).toBe(0)
  })
})

describe('deleteProductImage', () => {
  it('borra el blob (por url) y la fila, y reordena las restantes sin huecos', async () => {
    await addProductImage(productId, fileFormData('a.jpg'))
    await addProductImage(productId, fileFormData('b.jpg'))
    await addProductImage(productId, fileFormData('c.jpg'))
    const [first, second] = await prisma.productImage.findMany({ where: { productId }, orderBy: { order: 'asc' } })

    const res = await deleteProductImage(first.id)

    expect(res).toEqual({ ok: true })
    expect(del).toHaveBeenCalledWith(first.url)
    const remaining = await prisma.productImage.findMany({ where: { productId }, orderBy: { order: 'asc' } })
    expect(remaining.map((r) => r.order)).toEqual([0, 1])
    expect(remaining[0].id).toBe(second.id)
  })
})

describe('reorderProductImages', () => {
  it('reordena y permite mover una imagen a portada (order 0)', async () => {
    await addProductImage(productId, fileFormData('a.jpg'))
    await addProductImage(productId, fileFormData('b.jpg'))
    const [first, second] = await prisma.productImage.findMany({ where: { productId }, orderBy: { order: 'asc' } })

    const res = await reorderProductImages(productId, [second.id, first.id])

    expect(res).toEqual({ ok: true })
    const rows = await prisma.productImage.findMany({ where: { productId }, orderBy: { order: 'asc' } })
    expect(rows.map((r) => r.id)).toEqual([second.id, first.id])
  })

  it('rechaza si la lista de ids no coincide con las imágenes actuales', async () => {
    await addProductImage(productId, fileFormData('a.jpg'))
    const res = await reorderProductImages(productId, ['id-inexistente'])
    expect(res).toEqual({ ok: false, error: 'La lista de imágenes no coincide con las actuales' })
  })
})
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `pnpm test productImages`
Expected: FAIL — `Cannot find module './productImages'` (el archivo todavía no existe).

- [ ] **Step 3: Implementar las Server Actions**

Crear `src/server/actions/productImages.ts`:

```ts
'use server'
import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { put, del } from '@vercel/blob'
import { prisma } from '@/server/db'
import { requireRole } from '@/server/auth/guards'
import type { SaveResult } from './products'

export type { SaveResult }
export type ActionResult = { ok: true } | { ok: false; error: string }

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

function revalidateProduct(productId: string) {
  revalidatePath(`/productos/${productId}`)
  revalidatePath('/productos')
}

export async function addProductImage(productId: string, formData: FormData): Promise<SaveResult> {
  await requireRole('ADMIN')
  const file = formData.get('file')
  if (!(file instanceof File)) return { ok: false, error: 'No se recibió ningún archivo' }
  const ext = EXT_BY_MIME[file.type]
  if (!ext) return { ok: false, error: 'El archivo debe ser una imagen (JPG, PNG o WebP)' }
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: 'La imagen es demasiado pesada' }

  let blob: { url: string; pathname: string }
  try {
    blob = await put(`products/${productId}/${randomUUID()}.${ext}`, file, { access: 'public' })
  } catch {
    return { ok: false, error: 'No se pudo subir la imagen, probá de nuevo' }
  }

  const created = await prisma.$transaction(async (tx) => {
    const agg = await tx.productImage.aggregate({ where: { productId }, _max: { order: true } })
    const order = (agg._max.order ?? -1) + 1
    return tx.productImage.create({ data: { productId, url: blob.url, pathname: blob.pathname, order } })
  })
  revalidateProduct(productId)
  return { ok: true, id: created.id }
}

export async function deleteProductImage(imageId: string): Promise<ActionResult> {
  await requireRole('ADMIN')
  const image = await prisma.productImage.findUniqueOrThrow({ where: { id: imageId } })
  await del(image.url)
  await prisma.$transaction(async (tx) => {
    await tx.productImage.delete({ where: { id: imageId } })
    // Solo se borró una fila, así que a lo sumo las que quedan después del
    // hueco necesitan bajar un lugar (nunca subir ni chocar entre sí) — no
    // hace falta el truco de dos pasadas que sí necesita `reorderProductImages`.
    const remaining = await tx.productImage.findMany({
      where: { productId: image.productId },
      orderBy: { order: 'asc' },
    })
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i].order !== i) await tx.productImage.update({ where: { id: remaining[i].id }, data: { order: i } })
    }
  })
  revalidateProduct(image.productId)
  return { ok: true }
}

export async function reorderProductImages(productId: string, orderedImageIds: string[]): Promise<ActionResult> {
  await requireRole('ADMIN')
  const current = await prisma.productImage.findMany({ where: { productId }, select: { id: true } })
  const currentIds = new Set(current.map((i) => i.id))
  const matches = orderedImageIds.length === currentIds.size && orderedImageIds.every((id) => currentIds.has(id))
  if (!matches) return { ok: false, error: 'La lista de imágenes no coincide con las actuales' }

  await prisma.$transaction(async (tx) => {
    // Dos pasadas para no chocar contra `@@unique([productId, order])`:
    // primero valores negativos únicos, después los finales.
    for (let i = 0; i < orderedImageIds.length; i++) {
      await tx.productImage.update({ where: { id: orderedImageIds[i] }, data: { order: -(i + 1) } })
    }
    for (let i = 0; i < orderedImageIds.length; i++) {
      await tx.productImage.update({ where: { id: orderedImageIds[i] }, data: { order: i } })
    }
  })
  revalidateProduct(productId)
  return { ok: true }
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `pnpm test productImages`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/server/actions/productImages.ts src/server/actions/productImages.test.ts
git commit -m "feat: agrega Server Actions para subir/borrar/reordenar fotos de producto"
```

---

## Task 3: Exponer las imágenes en las queries de productos

**Files:**
- Modify: `src/server/queries/products.ts`
- Test: `src/server/queries/products.test.ts`

**Interfaces:**
- Consumes: modelo `ProductImage` (Task 1).
- Produces: `ProductRow` gana `coverImageUrl: string | null`; `getProduct` devuelve `images: { id, url, pathname, order, createdAt, productId }[]` ordenadas por `order` ascendente (viene del `include` de Prisma, sin tipo nombrado nuevo). Task 6 y Task 7 consumen estos dos campos.

- [ ] **Step 1: Escribir los tests (fallando)**

En `src/server/queries/products.test.ts`, agregar dentro de `describe('listProducts', ...)`:

```ts
  it('expone la portada (order 0) como coverImageUrl, o null si no tiene fotos', async () => {
    const p = await prisma.product.create({ data: { name: 'Sillón Milán', categoryId } })
    await prisma.productImage.create({
      data: { productId: p.id, url: 'https://blob.example/cover.jpg', pathname: 'products/x/cover.jpg', order: 0 },
    })
    const other = await prisma.product.create({ data: { name: 'Sillón Oslo', categoryId } })
    const { rows } = await listProducts({})
    expect(rows.find((r) => r.id === p.id)?.coverImageUrl).toBe('https://blob.example/cover.jpg')
    expect(rows.find((r) => r.id === other.id)?.coverImageUrl).toBeNull()
  })
```

Y dentro de `describe('getProduct', ...)`:

```ts
  it('incluye las imágenes ordenadas por order', async () => {
    const p = await prisma.product.create({ data: { name: 'Sillón Test', categoryId } })
    await prisma.productImage.create({
      data: { productId: p.id, url: 'https://blob.example/b.jpg', pathname: 'b', order: 1 },
    })
    await prisma.productImage.create({
      data: { productId: p.id, url: 'https://blob.example/a.jpg', pathname: 'a', order: 0 },
    })
    const detail = await getProduct(p.id)
    expect(detail?.images.map((i) => i.url)).toEqual(['https://blob.example/a.jpg', 'https://blob.example/b.jpg'])
  })
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `pnpm test src/server/queries/products.test.ts`
Expected: FAIL — `coverImageUrl` es `undefined` en vez de la URL esperada; `detail?.images` es `undefined`.

- [ ] **Step 3: Implementar el cambio en las queries**

En `src/server/queries/products.ts`:

```ts
import 'server-only'
import { prisma } from '@/server/db'
import { toNumber } from '@/lib/pricing'

export type ProductRow = {
  id: string; name: string; categoryName: string; variantCount: number
  defaultCost: number | null; defaultPrice: number | null; coverImageUrl: string | null
}

export async function listProducts(params: {
  q?: string; categoryId?: string; page?: number; pageSize?: number
}) {
  const pageSize = params.pageSize ?? 25
  const page = Math.max(1, params.page ?? 1)
  const where = {
    archivedAt: null,
    ...(params.categoryId ? { categoryId: params.categoryId } : {}),
    ...(params.q && params.q.trim()
      ? { name: { contains: params.q.trim(), mode: 'insensitive' as const } }
      : {}),
  }
  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where, orderBy: { name: 'asc' }, skip: (page - 1) * pageSize, take: pageSize,
      include: {
        category: { select: { name: true } },
        _count: { select: { variants: { where: { archivedAt: null } } } },
        images: { where: { order: 0 }, select: { url: true }, take: 1 },
      },
    }),
    prisma.product.count({ where }),
  ])
  return {
    rows: rows.map((p): ProductRow => ({
      id: p.id, name: p.name, categoryName: p.category.name, variantCount: p._count.variants,
      defaultCost: toNumber(p.defaultCost), defaultPrice: toNumber(p.defaultPrice),
      coverImageUrl: p.images[0]?.url ?? null,
    })),
    total,
  }
}

export async function getProduct(id: string) {
  return prisma.product.findFirst({
    where: { id, archivedAt: null },
    include: {
      category: { select: { id: true, name: true } },
      variants: { where: { archivedAt: null }, orderBy: { createdAt: 'asc' }, include: { stock: true } },
      images: { orderBy: { order: 'asc' } },
    },
  })
}

export type VariantOption = {
  variantId: string; productName: string; variantName: string; categoryName: string
}

export async function searchProductVariants(q: string, limit = 20): Promise<VariantOption[]> {
  const term = q.trim()
  if (term.length < 2) return []
  const like = { contains: term, mode: 'insensitive' as const }
  const rows = await prisma.productVariant.findMany({
    where: {
      archivedAt: null, product: { archivedAt: null },
      OR: [
        { name: like }, { medida: like }, { tela: like }, { color: like },
        { product: { name: like } },
      ],
    },
    take: limit, orderBy: [{ product: { name: 'asc' } }, { name: 'asc' }],
    include: { product: { select: { name: true, category: { select: { name: true } } } } },
  })
  return rows.map((v) => ({
    variantId: v.id, productName: v.product.name, variantName: v.name, categoryName: v.product.category.name,
  }))
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `pnpm test src/server/queries/products.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/queries/products.ts src/server/queries/products.test.ts
git commit -m "feat: expone coverImageUrl e images en las queries de productos"
```

---

## Task 4: Helper de compresión de imagen en el cliente

**Files:**
- Create: `src/lib/image-compress.ts`

**Interfaces:**
- Produces: `compressImage(file: File): Promise<File>`. Task 5 (`ProductImageGallery`) es el único consumidor.

Sin test automatizado (decisión ya tomada en el spec): `createImageBitmap`/`canvas.toBlob` no son fiables en jsdom, y esta lógica se valida mejor a mano en el browser que con un mock de Canvas que no probaría nada real.

- [ ] **Step 1: Implementar el helper**

Crear `src/lib/image-compress.ts`:

```ts
const MAX_DIMENSION = 1600
const JPEG_QUALITY = 0.8

// Redimensiona (si hace falta) y reencodea como JPEG en el browser antes de
// subir, ya que Vercel Blob no hace transformaciones de imagen server-side
// (a diferencia de Cloudinary). Si algo del pipeline de Canvas falla,
// devuelve el archivo original en vez de bloquear la subida.
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, width, height)

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
    if (!blob) return file

    const name = file.name.replace(/\.\w+$/, '') + '.jpg'
    return new File([blob], name, { type: 'image/jpeg' })
  } catch {
    return file
  }
}
```

- [ ] **Step 2: Verificar que compila**

Run: `pnpm exec tsc --noEmit`
Expected: sin errores nuevos relacionados a este archivo.

- [ ] **Step 3: Commit**

```bash
git add src/lib/image-compress.ts
git commit -m "feat: agrega compresión de imágenes en el cliente antes de subir"
```

---

## Task 5: Componente `ProductImageGallery`

**Files:**
- Create: `src/components/products/ProductImageGallery.tsx`
- Test: `src/components/products/ProductImageGallery.test.tsx`

**Interfaces:**
- Consumes: `addProductImage`, `deleteProductImage`, `reorderProductImages` (Task 2, firmas exactas de `src/server/actions/productImages.ts`), `compressImage` (Task 4), `useToast` (`@/components/ui/toast`).
- Produces: `ProductImageGallery({ productId: string; images: { id: string; url: string; order: number }[] })` — Client Component. Task 6 lo monta dentro de `ProductForm`.

- [ ] **Step 1: Escribir los tests (fallando)**

Crear `src/components/products/ProductImageGallery.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const { addProductImage, deleteProductImage, reorderProductImages, compressImage } = vi.hoisted(() => ({
  addProductImage: vi.fn().mockResolvedValue({ ok: true, id: 'img-new' }),
  deleteProductImage: vi.fn().mockResolvedValue({ ok: true }),
  reorderProductImages: vi.fn().mockResolvedValue({ ok: true }),
  compressImage: vi.fn(async (f: File) => f),
}))
vi.mock('@/server/actions/productImages', () => ({ addProductImage, deleteProductImage, reorderProductImages }))
vi.mock('@/lib/image-compress', () => ({ compressImage }))
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
import { ProductImageGallery } from './ProductImageGallery'

const images = [
  { id: 'i1', url: 'https://blob.example/i1.jpg', order: 0 },
  { id: 'i2', url: 'https://blob.example/i2.jpg', order: 1 },
]

describe('ProductImageGallery', () => {
  it('muestra "Sin fotos todavía" cuando no hay imágenes', () => {
    render(<ProductImageGallery productId="p1" images={[]} />)
    expect(screen.getByText('Sin fotos todavía')).toBeInTheDocument()
  })

  it('marca la primera imagen (order 0) como portada', () => {
    render(<ProductImageGallery productId="p1" images={images} />)
    expect(screen.getByText('Portada')).toBeInTheDocument()
  })

  it('comprime y sube el archivo elegido', async () => {
    render(<ProductImageGallery productId="p1" images={[]} />)
    const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' })
    await userEvent.upload(screen.getByLabelText('Agregar foto'), file)
    expect(compressImage).toHaveBeenCalledWith(file)
    expect(addProductImage).toHaveBeenCalledWith('p1', expect.any(FormData))
  })

  it('borra una imagen al hacer click en "Eliminar foto"', async () => {
    render(<ProductImageGallery productId="p1" images={images} />)
    await userEvent.click(screen.getAllByRole('button', { name: 'Eliminar foto' })[0])
    expect(deleteProductImage).toHaveBeenCalledWith('i1')
  })

  it('mueve una imagen con el botón "Mover después"', async () => {
    render(<ProductImageGallery productId="p1" images={images} />)
    await userEvent.click(screen.getAllByRole('button', { name: 'Mover después' })[0])
    expect(reorderProductImages).toHaveBeenCalledWith('p1', ['i2', 'i1'])
  })

  it('el botón "Mover antes" está deshabilitado en la primera imagen', () => {
    render(<ProductImageGallery productId="p1" images={images} />)
    expect(screen.getAllByRole('button', { name: 'Mover antes' })[0]).toBeDisabled()
  })
})
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `pnpm test ProductImageGallery`
Expected: FAIL — `Cannot find module './ProductImageGallery'`.

- [ ] **Step 3: Implementar el componente**

Crear `src/components/products/ProductImageGallery.tsx`:

```tsx
'use client'
import { useState, type ChangeEvent } from 'react'
import Image from 'next/image'
import { Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import { addProductImage, deleteProductImage, reorderProductImages } from '@/server/actions/productImages'
import { compressImage } from '@/lib/image-compress'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'

export type GalleryImage = { id: string; url: string; order: number }

export function ProductImageGallery({ productId, images }: { productId: string; images: GalleryImage[] }) {
  const { toast } = useToast()
  const [uploading, setUploading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const sorted = [...images].sort((a, b) => a.order - b.order)

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    const compressed = await compressImage(file)
    const formData = new FormData()
    formData.set('file', compressed)
    const res = await addProductImage(productId, formData)
    setUploading(false)
    if (!res.ok) toast(res.error, 'danger')
  }

  async function handleDelete(id: string) {
    setBusyId(id)
    const res = await deleteProductImage(id)
    setBusyId(null)
    if (!res.ok) toast(res.error, 'danger')
  }

  async function handleMove(id: string, direction: -1 | 1) {
    const idx = sorted.findIndex((img) => img.id === id)
    const swapWith = idx + direction
    if (swapWith < 0 || swapWith >= sorted.length) return
    const order = sorted.map((img) => img.id)
    ;[order[idx], order[swapWith]] = [order[swapWith], order[idx]]
    setBusyId(id)
    const res = await reorderProductImages(productId, order)
    setBusyId(null)
    if (!res.ok) toast(res.error, 'danger')
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-medium">Fotos</h2>
      {sorted.length === 0 && <p className="text-sm text-muted">Sin fotos todavía</p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {sorted.map((img, i) => (
          <div key={img.id} className="relative flex flex-col gap-1 rounded border border-border p-2">
            <div className="relative aspect-square overflow-hidden rounded bg-border/30">
              <Image src={img.url} alt="" fill className="object-cover" />
              {i === 0 && (
                <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
                  Portada
                </span>
              )}
            </div>
            <div className="flex items-center justify-between gap-1">
              <Button
                type="button" variant="ghost" size="sm" disabled={busyId === img.id || i === 0}
                onClick={() => handleMove(img.id, -1)} aria-label="Mover antes"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                type="button" variant="ghost" size="sm" disabled={busyId === img.id || i === sorted.length - 1}
                onClick={() => handleMove(img.id, 1)} aria-label="Mover después"
              >
                <ChevronRight className="size-4" />
              </Button>
              <Button
                type="button" variant="danger" size="sm" disabled={busyId === img.id}
                onClick={() => handleDelete(img.id)} aria-label="Eliminar foto"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
      <label className="flex w-full max-w-xs flex-col gap-1">
        <span className="text-sm">Agregar foto</span>
        <input
          aria-label="Agregar foto"
          type="file"
          accept="image/*"
          disabled={uploading}
          onChange={handleFileChange}
          className="text-sm"
        />
      </label>
      {uploading && <p className="text-sm text-muted">Subiendo…</p>}
    </div>
  )
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `pnpm test ProductImageGallery`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/products/ProductImageGallery.tsx src/components/products/ProductImageGallery.test.tsx
git commit -m "feat: agrega el componente ProductImageGallery"
```

---

## Task 6: Integrar la galería en `ProductForm` (edición de producto)

**Files:**
- Modify: `src/components/forms/ProductForm.tsx`
- Modify: `src/components/forms/ProductForm.test.tsx`

**Interfaces:**
- Consumes: `ProductImageGallery` (Task 5).
- Produces: `ProductDetail` (tipo exportado de `ProductForm.tsx`) gana el campo `images: { id: string; url: string; order: number }[]`. `src/app/(app)/productos/[id]/page.tsx` no necesita cambios: ya arma `detail` con `{ ...product, ... }`, y `product.images` (de la query de Task 3) pasa a través de ese spread sin tocarlo.

- [ ] **Step 1: Actualizar el test existente (fallando)**

En `src/components/forms/ProductForm.test.tsx`, el fixture `product: ProductDetail` del bloque `describe('ProductForm (edit)', ...)` necesita el campo nuevo para seguir tipando. Reemplazar:

```ts
  const product: ProductDetail = {
    id: 'p1', name: 'Respaldo', categoryId: 'c1', description: null,
    defaultCost: null, defaultPrice: null,
    variants: [
      {
        id: 'v1', name: 'Rojo', medida: '1,40m', tela: 'Pana', color: 'Rojo',
        cost: '100', price: '200', sku: 'SKU-ROJO', isDefault: true, stock: null,
      },
    ],
  }
```

por:

```ts
  const product: ProductDetail = {
    id: 'p1', name: 'Respaldo', categoryId: 'c1', description: null,
    defaultCost: null, defaultPrice: null,
    variants: [
      {
        id: 'v1', name: 'Rojo', medida: '1,40m', tela: 'Pana', color: 'Rojo',
        cost: '100', price: '200', sku: 'SKU-ROJO', isDefault: true, stock: null,
      },
    ],
    images: [{ id: 'img1', url: 'https://blob.example/img1.jpg', order: 0 }],
  }
```

Y agregar, dentro de `describe('ProductForm (edit)', ...)`, un mock de `ProductImageGallery` (no queremos re-testear su lógica interna acá, ya la cubre `ProductImageGallery.test.tsx`) más un test que confirme el wiring:

Al principio del archivo, junto a los otros `vi.mock`:

```ts
vi.mock('@/components/products/ProductImageGallery', () => ({
  ProductImageGallery: ({ productId, images }: { productId: string; images: { id: string }[] }) => (
    <div data-testid="gallery">{productId}:{images.length}</div>
  ),
}))
```

Y el test nuevo:

```ts
  it('monta ProductImageGallery con el productId y las imágenes del producto', () => {
    render(<ProductForm mode="edit" product={product} categories={cats} />)
    expect(screen.getByTestId('gallery')).toHaveTextContent('p1:1')
  })
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `pnpm test ProductForm`
Expected: FAIL — el fixture no tipa (`images` no existe en `ProductDetail`) y `getByTestId('gallery')` no encuentra nada.

- [ ] **Step 3: Actualizar `ProductForm.tsx`**

Agregar el import (junto a los demás, en `src/components/forms/ProductForm.tsx`):

```ts
import { ProductImageGallery } from '@/components/products/ProductImageGallery'
```

Extender el tipo `ProductDetail` (agregar el campo al final del tipo existente):

```ts
export type ProductDetail = {
  id: string
  name: string
  categoryId: string
  description: string | null
  defaultCost: number | string | null
  defaultPrice: number | string | null
  variants: Array<{
    id: string
    name: string
    medida: string | null
    tela: string | null
    color: string | null
    cost: number | string | null
    price: number | string | null
    sku: string | null
    isDefault: boolean
    stock: { quantity: number } | null
  }>
  images: Array<{ id: string; url: string; order: number }>
}
```

Y agregar la sección de fotos en el JSX, justo antes del botón "Archivar producto" (dentro del bloque `{props.mode === 'edit' && (...)}` de las variantes, se agrega un bloque hermano nuevo):

```tsx
      {props.mode === 'edit' && (
        <ProductImageGallery productId={props.product.id} images={props.product.images} />
      )}

      {props.mode === 'edit' && (
        <Button variant="danger" className="w-full md:w-auto" onClick={handleArchiveProduct}>
          Archivar producto
        </Button>
      )}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `pnpm test ProductForm`
Expected: PASS.

- [ ] **Step 5: Correr toda la suite**

Run: `pnpm test`
Expected: PASS (nada roto en otros archivos que usan `ProductDetail`/`ProductForm`).

- [ ] **Step 6: Commit**

```bash
git add src/components/forms/ProductForm.tsx src/components/forms/ProductForm.test.tsx
git commit -m "feat: integra la galería de fotos en la pantalla de edición de producto"
```

---

## Task 7: Miniatura de portada en el listado de productos

**Files:**
- Modify: `src/components/products/ProductList.tsx`
- Modify: `src/components/products/ProductList.test.tsx`

**Interfaces:**
- Consumes: `ProductRow.coverImageUrl` (Task 3).

- [ ] **Step 1: Actualizar el test existente (fallando)**

En `src/components/products/ProductList.test.tsx`, el fixture necesita el campo nuevo para tipar:

```ts
const rows = [{ id: 'p1', name: 'Sillón Milán', categoryName: 'Sillones', variantCount: 2, defaultCost: 100, defaultPrice: 250, coverImageUrl: null }]
```

Y agregar un test nuevo dentro de `describe('ProductList', ...)`:

```ts
  it('muestra la miniatura de portada cuando el producto tiene coverImageUrl', () => {
    const withCover = [{ ...rows[0], coverImageUrl: 'https://blob.example/cover.jpg' }]
    render(<ProductList rows={withCover} />)
    expect(screen.getAllByAltText('').length).toBeGreaterThan(0)
  })
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `pnpm test ProductList`
Expected: FAIL — el fixture original no tipa (`coverImageUrl` falta en `ProductRow`) y no hay ninguna imagen renderizada todavía.

- [ ] **Step 3: Actualizar `ProductList.tsx`**

```tsx
import Link from 'next/link'
import Image from 'next/image'
import { ImageOff } from 'lucide-react'
import type { ProductRow } from '@/server/queries/products'
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table'
import { money } from '@/lib/format'

function CoverThumb({ url }: { url: string | null }) {
  if (!url) {
    return (
      <div className="flex size-10 items-center justify-center rounded bg-border/30 text-muted">
        <ImageOff className="size-4" />
      </div>
    )
  }
  return <Image src={url} alt="" width={40} height={40} className="size-10 rounded object-cover" />
}

export function ProductList({ rows }: { rows: ProductRow[] }) {
  return (
    <>
      {/* ≥ md: tabla */}
      <div className="hidden md:block mt-4">
        <Table>
          <Thead>
            <Tr><Th>Foto</Th><Th>Producto</Th><Th>Categoría</Th><Th className="text-right">Variantes</Th>
              <Th className="text-right">Costo sug.</Th><Th className="text-right">PVP sug.</Th></Tr>
          </Thead>
          <Tbody>
            {rows.map((p) => (
              <Tr key={p.id}>
                <Td><CoverThumb url={p.coverImageUrl} /></Td>
                <Td><Link href={`/productos/${p.id}`} className="underline">{p.name}</Link></Td>
                <Td>{p.categoryName}</Td>
                <Td className="text-right">{p.variantCount}</Td>
                <Td className="text-right">{money(p.defaultCost)}</Td>
                <Td className="text-right">{money(p.defaultPrice)}</Td>
              </Tr>
            ))}
            {rows.length === 0 && <Tr><Td colSpan={6} className="text-center text-muted">Sin resultados</Td></Tr>}
          </Tbody>
        </Table>
      </div>

      {/* < md: tarjetas */}
      <ul className="md:hidden mt-4 space-y-2">
        {rows.map((p) => (
          <li key={p.id}>
            <article className="border border-border rounded-lg bg-card p-3 flex gap-3">
              <CoverThumb url={p.coverImageUrl} />
              <div className="flex-1">
                <Link href={`/productos/${p.id}`} className="font-medium underline">{p.name}</Link>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                  <dt className="text-muted">Categoría</dt><dd>{p.categoryName}</dd>
                  <dt className="text-muted">Variantes</dt><dd>{p.variantCount}</dd>
                  <dt className="text-muted">Costo sug.</dt><dd>{money(p.defaultCost)}</dd>
                  <dt className="text-muted">PVP sug.</dt><dd>{money(p.defaultPrice)}</dd>
                </dl>
              </div>
            </article>
          </li>
        ))}
        {rows.length === 0 && <li className="text-center text-muted py-4">Sin resultados</li>}
      </ul>
    </>
  )
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `pnpm test ProductList`
Expected: PASS.

- [ ] **Step 5: Correr toda la suite**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/products/ProductList.tsx src/components/products/ProductList.test.tsx
git commit -m "feat: muestra la miniatura de portada en el listado de productos"
```

---

## Verificación final

Después de la Task 7:

```bash
pnpm test
pnpm lint
pnpm exec tsc --noEmit
```

Todo debe pasar en verde. Falta manual (no automatizable en esta sesión): crear el Blob Store en Vercel, cargar `BLOB_READ_WRITE_TOKEN` real en `.env` y en Vercel, y probar subir/borrar/reordenar una foto desde `/productos/[id]` en el browser.
