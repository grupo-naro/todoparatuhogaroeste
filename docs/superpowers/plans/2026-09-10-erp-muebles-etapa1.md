# ERP Fábrica de Muebles — Etapa 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Desplegar un MVP funcional que permita cargar el inventario físico de una fábrica de muebles mediante una grilla rápida y consultarlo en tiempo real, con login por roles.

**Architecture:** Next.js 16 App Router. Lecturas mediante Server Components que llaman a `server/queries/*` (Prisma). Escrituras mediante Server Actions (`'use server'`) que validan con Zod, ejecutan `prisma.$transaction` y revalidan rutas. Autenticación con JWT propio (`jose`) en cookie `httpOnly`, verificado en `proxy.ts` y en cada action. Un ledger append-only (`InventoryTransaction`) es la fuente de verdad; `InventoryStock` es un snapshot para lectura rápida.

**Tech Stack:** Next.js 16.3.4, React 19.2, TypeScript 5 strict, Tailwind CSS v4, Prisma + PostgreSQL (Neon), `jose`, `bcryptjs`, `zod`, `@tanstack/react-table` v8, `@radix-ui/react-*`, `lucide-react`, Vitest + `@testing-library/react`.

**Spec:** `docs/superpowers/specs/2026-09-10-erp-muebles-etapa1-design.md` — leer ambos documentos antes de ejecutar.

## Global Constraints

- **Next.js 16 — APIs cambiadas.** Antes de tocar cualquier feature de framework, leer la guía en `node_modules/next/dist/docs/01-app/`. En particular: `cookies()`, `params`, `searchParams` son **asíncronos** (`await`); el archivo de middleware se llama `proxy.ts` (no `middleware.ts`); Turbopack es el default (no pasar `--turbopack`).
- **Runtime:** Node.js ≥ 20.9, TypeScript ≥ 5.1.
- **Toda Server Action y Route Handler mutante empieza con `await requireUser()`** (o `await requireRole('ADMIN')`), porque son endpoints POST accesibles directamente. Sin excepción.
- **Toda mutación de stock ocurre dentro de `prisma.$transaction`** — nunca escribir `InventoryStock` sin insertar el `InventoryTransaction` correspondiente en la misma transacción.
- **Borrado siempre soft:** `archivedAt` (categorías, productos, variantes) o `active=false` (usuarios). Nunca `DELETE` físico de entidades con historial.
- **Montos:** `Decimal(12, 2)`. **Cantidades:** enteros ≥ 0. Moneda de display: ARS (`Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })`).
- **Costo/Precio efectivo:** `coalesce(variant.cost, product.defaultCost)` — nunca se persiste, se calcula en `server/queries`.
- **`CARGA_INICIAL` es ajuste absoluto:** la cantidad recibida ES el stock resultante; se registra `quantityDelta = contado - actual` y `quantityAfter = contado`.
- **Alias de imports:** `@/*` → `src/*`.
- **Idioma:** UI, rutas, mensajes de error y copy en español. Código (identificadores) en inglés.
- **Commits:** frecuentes, uno por tarea como mínimo. Formato Conventional Commits. Terminar el mensaje con `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- **Prioridades:** las tareas están ordenadas. **P0** = Tasks 1–23 y 25 (deploy): forman el vertical funcional que se despliega para el deadline. **P1** = Task 24 (ABM de usuarios) y el ordenamiento de columnas dentro de la Task 23. **P2** = Task 26 (pegar cantidades desde Excel). P1/P2 no bloquean el deploy.

---

## Phase 0 — Setup del proyecto

### Task 1: Dependencias, tooling y utilidades base

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`, `vitest.setup.ts`
- Create: `src/lib/cn.ts`, `src/lib/format.ts`, `src/lib/constants.ts`
- Test: `src/lib/format.test.ts`
- Modify: `src/app/globals.css`, `src/app/layout.tsx`

**Interfaces:**
- Produces:
  - `cn(...inputs: ClassValue[]): string`
  - `money(value: number | string | null | undefined): string` — ARS; `null`/`undefined`/`''` → `"—"`
  - `integer(value: number | null | undefined): string` — miles es-AR; `null` → `"0"`
  - `formatDate(value: Date | string): string` — `dd/MM/yyyy HH:mm`
  - `ROLES`, `RoleName`, `TRANSACTION_TYPES`, `TransactionTypeName`, `SEED_CATEGORIES`

- [ ] **Step 1: Instalar dependencias**

```bash
pnpm add @prisma/client zod jose bcryptjs @tanstack/react-table lucide-react clsx tailwind-merge @radix-ui/react-dialog @radix-ui/react-select @radix-ui/react-popover @radix-ui/react-toast @radix-ui/react-slot
pnpm add -D prisma vitest @vitejs/plugin-react @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom @types/bcryptjs
```

- [ ] **Step 2: Scripts en `package.json`**

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:migrate": "prisma migrate dev",
    "db:deploy": "prisma migrate deploy",
    "db:seed": "prisma db seed",
    "db:studio": "prisma studio"
  },
  "prisma": { "seed": "node --experimental-strip-types prisma/seed.ts" }
}
```

- [ ] **Step 3: `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
})
```

- [ ] **Step 4: `vitest.setup.ts`**

```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 5: `src/lib/cn.ts`**

```ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 6: Test que falla — `src/lib/format.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { money, integer, formatDate } from './format'

const nbsp = (s: string) => s.replace(/ | /g, ' ')

describe('money', () => {
  it('formatea ARS', () => { expect(nbsp(money(1234.5))).toBe('$ 1.234,50') })
  it('— para null/undefined/vacío', () => {
    expect(money(null)).toBe('—'); expect(money(undefined)).toBe('—'); expect(money('')).toBe('—')
  })
  it('acepta strings decimales', () => { expect(nbsp(money('1000'))).toBe('$ 1.000,00') })
})

describe('integer', () => {
  it('agrupa miles', () => { expect(integer(12000)).toBe('12.000') })
  it('0 para null', () => { expect(integer(null)).toBe('0') })
})

describe('formatDate', () => {
  it('dd/MM/yyyy HH:mm', () => {
    expect(formatDate(new Date('2026-09-10T14:30:00'))).toBe('10/09/2026 14:30')
  })
})
```

- [ ] **Step 7: Ejecutar — debe fallar**

Run: `pnpm test src/lib/format.test.ts` → FAIL (`Cannot find module './format'`).

- [ ] **Step 8: Implementar `src/lib/format.ts`**

```ts
const ARS = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 })
const INT = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })
const DATE = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
})

export function money(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  const n = typeof value === 'string' ? Number(value) : value
  return Number.isNaN(n) ? '—' : ARS.format(n)
}

export function integer(value: number | null | undefined): string {
  return value === null || value === undefined ? '0' : INT.format(value)
}

export function formatDate(value: Date | string): string {
  const d = typeof value === 'string' ? new Date(value) : value
  return DATE.format(d).replace(',', '')
}
```

- [ ] **Step 9: `src/lib/constants.ts`**

```ts
export const ROLES = ['ADMIN', 'DEPOSITO'] as const
export type RoleName = (typeof ROLES)[number]

export const TRANSACTION_TYPES = ['CARGA_INICIAL', 'AJUSTE'] as const
export type TransactionTypeName = (typeof TRANSACTION_TYPES)[number]

export const SEED_CATEGORIES = [
  'Somieres', 'Respaldos', 'Sillones', 'Mesas', 'Sillas', 'Muebles a medida / Otros',
] as const
```

- [ ] **Step 10: Tokens de color en `src/app/globals.css`** (mantener `@import "tailwindcss";`)

```css
@import "tailwindcss";

:root {
  --background: #f8f8f7; --foreground: #1a1a1a; --card: #ffffff; --border: #e4e4e2;
  --muted: #6b6b6b; --primary: #1a1a1a; --primary-foreground: #ffffff;
  --danger: #b42318; --success: #067647;
}

@theme inline {
  --color-background: var(--background); --color-foreground: var(--foreground);
  --color-card: var(--card); --color-border: var(--border); --color-muted: var(--muted);
  --color-primary: var(--primary); --color-primary-foreground: var(--primary-foreground);
  --color-danger: var(--danger); --color-success: var(--success);
  --font-sans: var(--font-geist-sans);
}

body { background: var(--color-background); color: var(--color-foreground); }
```

- [ ] **Step 11: `src/app/layout.tsx`** — `lang="es"` y metadata

```tsx
export const metadata: Metadata = {
  title: 'Gestión — Depósito',
  description: 'Sistema de gestión de inventario',
}
// <html lang="es" ...>
```

- [ ] **Step 12: Verificar**

Run: `pnpm test && pnpm build` → tests PASS, build OK.

- [ ] **Step 13: Commit**

```bash
git add -A && git commit -m "chore: setup tooling, deps y utilidades base (format, cn, constants)"
```

---

### Task 2: Schema Prisma, cliente, migración inicial y seed

**Files:**
- Create: `prisma/schema.prisma`, `prisma/seed.ts`
- Create: `src/server/db.ts`
- Create: `.env` (git-ignored), `.env.example`
- Create: `prisma/migrations/**`

**Interfaces:**
- Produces:
  - `prisma` — `PrismaClient` singleton desde `src/server/db.ts`
  - Modelos `User`, `Category`, `Product`, `ProductVariant`, `InventoryStock`, `InventoryTransaction`
  - Enums `Role` (`ADMIN` | `DEPOSITO`), `TransactionType` (`CARGA_INICIAL` | `AJUSTE`)

- [ ] **Step 1: `.env.example`** (y copiar a `.env` con valores reales de Neon o Postgres local)

```bash
DATABASE_URL="postgresql://user:pass@host-pooler.neon.tech/db?sslmode=require"
DIRECT_URL="postgresql://user:pass@host.neon.tech/db?sslmode=require"
AUTH_SECRET="genera-con: openssl rand -base64 32"
SEED_ADMIN_EMAIL="admin@local"
SEED_ADMIN_PASSWORD="cambiar-en-produccion"
```

- [ ] **Step 2: `prisma/schema.prisma`** — copiar íntegro de la sección 4 del spec, con este encabezado:

```prisma
generator client { provider = "prisma-client-js" }
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

Y a continuación los `enum Role`, `enum TransactionType` y los 6 modelos tal cual el spec (con `@@unique`, `@@index`, `onDelete` incluidos).

- [ ] **Step 3: Migración inicial**

Run: `pnpm db:migrate --name init` → crea `prisma/migrations/<ts>_init/` y genera `PrismaClient`.

- [ ] **Step 4: CHECK de stock no negativo**

Run: `pnpm exec prisma migrate dev --create-only --name add_stock_check`
Dejar el `migration.sql` con una sola línea y aplicar con `pnpm db:migrate`:

```sql
ALTER TABLE "InventoryStock" ADD CONSTRAINT "InventoryStock_quantity_non_negative" CHECK ("quantity" >= 0);
```

- [ ] **Step 5: `src/server/db.ts`**

```ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }
export const prisma = globalForPrisma.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

- [ ] **Step 6: `prisma/seed.ts`**

```ts
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()
const CATEGORIES = ['Somieres', 'Respaldos', 'Sillones', 'Mesas', 'Sillas', 'Muebles a medida / Otros']
const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

async function main() {
  for (const name of CATEGORIES) {
    await prisma.category.upsert({ where: { name }, update: {}, create: { name, slug: slugify(name) } })
  }
  const email = process.env.SEED_ADMIN_EMAIL
  const password = process.env.SEED_ADMIN_PASSWORD
  if (email && password) {
    await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, name: 'Administrador', role: 'ADMIN', passwordHash: await bcrypt.hash(password, 10) },
    })
  }
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error(e); await prisma.$disconnect(); process.exit(1)
})
```

- [ ] **Step 7: Seed y verificación**

Run: `pnpm db:seed` → 6 categorías + 1 usuario ADMIN. Verificar con `pnpm db:studio`.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: schema Prisma (6 modelos + ledger), migración inicial y seed"
```

---

## Phase 1 — Autenticación y app shell

### Task 3: Hash de contraseñas

**Files:**
- Create: `src/server/auth/password.ts`
- Test: `src/server/auth/password.test.ts`

**Interfaces:**
- Produces:
  - `hashPassword(plain: string): Promise<string>`
  - `verifyPassword(plain: string, hash: string): Promise<boolean>`

- [ ] **Step 1: Test que falla — `src/server/auth/password.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from './password'

describe('password', () => {
  it('un hash verifica contra su texto plano', async () => {
    const hash = await hashPassword('secreto123')
    expect(hash).not.toBe('secreto123')
    expect(await verifyPassword('secreto123', hash)).toBe(true)
  })
  it('rechaza una contraseña incorrecta', async () => {
    const hash = await hashPassword('secreto123')
    expect(await verifyPassword('otra', hash)).toBe(false)
  })
})
```

- [ ] **Step 2: Ejecutar — debe fallar**

Run: `pnpm test src/server/auth/password.test.ts` → FAIL.

- [ ] **Step 3: Implementar `src/server/auth/password.ts`**

```ts
import bcrypt from 'bcryptjs'

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10)
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}
```

- [ ] **Step 4: Ejecutar — debe pasar**

Run: `pnpm test src/server/auth/password.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: helpers de hash de contraseña (bcryptjs)"
```

---

### Task 4: Sesión JWT (crear / leer / destruir)

**Files:**
- Create: `src/server/auth/session.ts`
- Test: `src/server/auth/session.test.ts`

**Interfaces:**
- Consumes: `process.env.AUTH_SECRET`
- Produces:
  - `type SessionPayload = { sub: string; role: RoleName; name: string }`
  - `signSession(payload: SessionPayload): Promise<string>` — JWT HS256, exp 8h
  - `verifySessionToken(token: string): Promise<SessionPayload | null>` — `null` si inválido/expirado
  - `SESSION_COOKIE = 'session'`
  - `createSession(payload: SessionPayload): Promise<void>` — set cookie httpOnly
  - `readSession(): Promise<SessionPayload | null>` — lee cookie (usa `await cookies()`)
  - `destroySession(): Promise<void>` — borra cookie

- [ ] **Step 1: Test que falla — `src/server/auth/session.test.ts`** (solo la parte pura, sin `cookies()`)

```ts
import { describe, expect, it, beforeAll } from 'vitest'
import { signSession, verifySessionToken } from './session'

beforeAll(() => { process.env.AUTH_SECRET = 'test-secret-para-vitest-1234567890' })

describe('session token', () => {
  it('firma y verifica un payload', async () => {
    const token = await signSession({ sub: 'u1', role: 'ADMIN', name: 'Ana' })
    expect(await verifySessionToken(token)).toMatchObject({ sub: 'u1', role: 'ADMIN', name: 'Ana' })
  })
  it('devuelve null para un token corrupto', async () => {
    expect(await verifySessionToken('no.es.jwt')).toBeNull()
  })
})
```

- [ ] **Step 2: Ejecutar — debe fallar**

Run: `pnpm test src/server/auth/session.test.ts` → FAIL.

- [ ] **Step 3: Implementar `src/server/auth/session.ts`**

```ts
import 'server-only'
import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'
import type { RoleName } from '@/lib/constants'

export const SESSION_COOKIE = 'session'
const MAX_AGE = 60 * 60 * 8 // 8h

export type SessionPayload = { sub: string; role: RoleName; name: string }

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET
  if (!s) throw new Error('AUTH_SECRET no configurado')
  return new TextEncoder().encode(s)
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ role: payload.role, name: payload.name })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret())
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret())
    if (!payload.sub || typeof payload.role !== 'string' || typeof payload.name !== 'string') return null
    return { sub: payload.sub, role: payload.role as RoleName, name: payload.name }
  } catch {
    return null
  }
}

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await signSession(payload)
  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', path: '/', maxAge: MAX_AGE,
  })
}

export async function readSession(): Promise<SessionPayload | null> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  return token ? verifySessionToken(token) : null
}

export async function destroySession(): Promise<void> {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
}
```

- [ ] **Step 4: Ejecutar — debe pasar**

Run: `pnpm test src/server/auth/session.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: sesión JWT con jose (sign/verify/create/read/destroy)"
```

---

### Task 5: Guards de servidor y `proxy.ts`

**Files:**
- Create: `src/server/auth/guards.ts`
- Create: `proxy.ts` (raíz del proyecto)
- Test: `src/server/auth/guards.test.ts`

**Interfaces:**
- Consumes: `readSession`, `SessionPayload` (Task 4); `verifySessionToken`, `SESSION_COOKIE`
- Produces:
  - `requireUser(): Promise<SessionPayload>` — `redirect('/login')` si no hay sesión
  - `requireRole(role: RoleName): Promise<SessionPayload>` — además `redirect('/deposito')` si el rol no coincide

- [ ] **Step 1: Test que falla — `src/server/auth/guards.test.ts`** (mockeando `next/navigation` y `readSession`)

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest'

const redirect = vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`) })
vi.mock('next/navigation', () => ({ redirect }))
const readSession = vi.fn()
vi.mock('./session', () => ({ readSession }))

import { requireUser, requireRole } from './guards'

beforeEach(() => { redirect.mockClear(); readSession.mockReset() })

describe('requireUser', () => {
  it('devuelve la sesión si existe', async () => {
    readSession.mockResolvedValue({ sub: 'u1', role: 'DEPOSITO', name: 'Ana' })
    await expect(requireUser()).resolves.toMatchObject({ sub: 'u1' })
  })
  it('redirige a /login si no hay sesión', async () => {
    readSession.mockResolvedValue(null)
    await expect(requireUser()).rejects.toThrow('REDIRECT:/login')
  })
})

describe('requireRole', () => {
  it('redirige a /deposito si el rol no coincide', async () => {
    readSession.mockResolvedValue({ sub: 'u1', role: 'DEPOSITO', name: 'Ana' })
    await expect(requireRole('ADMIN')).rejects.toThrow('REDIRECT:/deposito')
  })
  it('devuelve la sesión si el rol coincide', async () => {
    readSession.mockResolvedValue({ sub: 'u1', role: 'ADMIN', name: 'Ana' })
    await expect(requireRole('ADMIN')).resolves.toMatchObject({ role: 'ADMIN' })
  })
})
```

- [ ] **Step 2: Ejecutar — debe fallar**

Run: `pnpm test src/server/auth/guards.test.ts` → FAIL.

- [ ] **Step 3: Implementar `src/server/auth/guards.ts`**

```ts
import 'server-only'
import { redirect } from 'next/navigation'
import type { RoleName } from '@/lib/constants'
import { readSession, type SessionPayload } from './session'

export async function requireUser(): Promise<SessionPayload> {
  const session = await readSession()
  if (!session) redirect('/login')
  return session
}

export async function requireRole(role: RoleName): Promise<SessionPayload> {
  const session = await requireUser()
  if (session.role !== role) redirect('/deposito')
  return session
}
```

- [ ] **Step 4: Ejecutar — debe pasar**

Run: `pnpm test src/server/auth/guards.test.ts` → PASS.

- [ ] **Step 5: Crear `proxy.ts`** en la raíz (mismo nivel que `src/`)

```ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifySessionToken, SESSION_COOKIE } from '@/server/auth/session'

const PUBLIC_PATHS = ['/login', '/api/health']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next()
  }
  const token = request.cookies.get(SESSION_COOKIE)?.value
  const session = token ? await verifySessionToken(token) : null
  if (!session) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

> `proxy.ts` corre en runtime edge por defecto; `jose` es compatible. `bcryptjs` **no** debe importarse aquí (solo en Server Actions Node).

- [ ] **Step 6: Verificar build**

Run: `pnpm build` → compila sin error de `proxy.ts`.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: guards de servidor (requireUser/requireRole) y proxy de auth"
```

---

### Task 6: Helper de DB para tests + acciones `signIn` / `signOut` + página de login

**Files:**
- Create: `src/test/db.ts`
- Create: `src/server/validation/auth.ts`
- Create: `src/server/actions/auth.ts`
- Create: `src/app/(auth)/login/page.tsx`
- Create: `src/app/(auth)/layout.tsx`
- Test: `src/server/actions/auth.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 2), `verifyPassword` (Task 3), `createSession`/`destroySession` (Task 4)
- Produces:
  - `resetDb(): Promise<void>` — trunca todas las tablas (para `beforeEach` de integración)
  - `loginSchema` (zod): `{ email: string.email, password: string.min(1) }`
  - `signIn(_prev, formData: FormData): Promise<{ error: string } | never>` — Server Action; en éxito `redirect('/deposito')`
  - `signOut(): Promise<never>` — Server Action; `destroySession()` + `redirect('/login')`

- [ ] **Step 1: `src/test/db.ts`** (los tests de integración requieren `DATABASE_URL` apuntando a una base de **test**: Postgres local o branch de Neon; corre migraciones antes con `pnpm db:deploy`)

```ts
import { prisma } from '@/server/db'

export { prisma }

export async function resetDb(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "InventoryTransaction","InventoryStock","ProductVariant","Product","Category","User" RESTART IDENTITY CASCADE;',
  )
}
```

- [ ] **Step 2: `src/server/validation/auth.ts`**

```ts
import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Ingresá la contraseña'),
})
```

- [ ] **Step 3: Test que falla — `src/server/actions/auth.test.ts`**

```ts
import { describe, expect, it, beforeEach, beforeAll, vi } from 'vitest'

const redirect = vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`) })
vi.mock('next/navigation', () => ({ redirect }))
const createSession = vi.fn()
const destroySession = vi.fn()
vi.mock('@/server/auth/session', () => ({ createSession, destroySession, SESSION_COOKIE: 'session' }))

import { prisma, resetDb } from '@/test/db'
import { hashPassword } from '@/server/auth/password'
import { signIn } from './auth'

beforeAll(() => { process.env.AUTH_SECRET = 'test-secret-1234567890' })
beforeEach(async () => { await resetDb(); redirect.mockClear(); createSession.mockClear() })

const fd = (email: string, password: string) => {
  const f = new FormData(); f.set('email', email); f.set('password', password); return f
}

describe('signIn', () => {
  it('con credenciales válidas crea sesión y redirige a /deposito', async () => {
    await prisma.user.create({
      data: { email: 'a@a.com', name: 'Ana', role: 'DEPOSITO', passwordHash: await hashPassword('secreto123') },
    })
    await expect(signIn(undefined, fd('a@a.com', 'secreto123'))).rejects.toThrow('REDIRECT:/deposito')
    expect(createSession).toHaveBeenCalledWith(expect.objectContaining({ role: 'DEPOSITO', name: 'Ana' }))
  })
  it('con contraseña incorrecta devuelve error y no crea sesión', async () => {
    await prisma.user.create({
      data: { email: 'a@a.com', name: 'Ana', role: 'DEPOSITO', passwordHash: await hashPassword('secreto123') },
    })
    expect(await signIn(undefined, fd('a@a.com', 'mala'))).toEqual({ error: 'Email o contraseña incorrectos' })
    expect(createSession).not.toHaveBeenCalled()
  })
  it('usuario inactivo no puede ingresar', async () => {
    await prisma.user.create({
      data: { email: 'a@a.com', name: 'Ana', role: 'DEPOSITO', active: false, passwordHash: await hashPassword('secreto123') },
    })
    expect(await signIn(undefined, fd('a@a.com', 'secreto123'))).toEqual({ error: 'Usuario inactivo' })
  })
})
```

- [ ] **Step 4: Ejecutar — debe fallar**

Run: `pnpm test src/server/actions/auth.test.ts` → FAIL.

- [ ] **Step 5: Implementar `src/server/actions/auth.ts`**

```ts
'use server'

import { redirect } from 'next/navigation'
import { prisma } from '@/server/db'
import { verifyPassword } from '@/server/auth/password'
import { createSession, destroySession } from '@/server/auth/session'
import { loginSchema } from '@/server/validation/auth'

export async function signIn(_prev: unknown, formData: FormData): Promise<{ error: string }> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'), password: formData.get('password'),
  })
  if (!parsed.success) return { error: 'Email o contraseña incorrectos' }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } })
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return { error: 'Email o contraseña incorrectos' }
  }
  if (!user.active) return { error: 'Usuario inactivo' }

  await createSession({ sub: user.id, role: user.role, name: user.name })
  redirect('/deposito')
}

export async function signOut(): Promise<void> {
  await destroySession()
  redirect('/login')
}
```

- [ ] **Step 6: Ejecutar — debe pasar**

Run: `pnpm test src/server/actions/auth.test.ts` → PASS.

- [ ] **Step 7: `src/app/(auth)/layout.tsx`** (centrado, sin sidebar)

```tsx
export default function AuthLayout({ children }: LayoutProps<'/login'>) {
  return <main className="min-h-full grid place-items-center p-4">{children}</main>
}
```

- [ ] **Step 8: `src/app/(auth)/login/page.tsx`** (Client Component con `useActionState`)

```tsx
'use client'
import { useActionState } from 'react'
import { signIn } from '@/server/actions/auth'

export default function LoginPage() {
  const [state, action, pending] = useActionState(signIn, undefined)
  return (
    <form action={action} className="w-full max-w-sm bg-card border border-border rounded-lg p-6 space-y-4">
      <h1 className="text-lg font-semibold">Ingresar</h1>
      <label className="block text-sm">Email
        <input name="email" type="email" required autoFocus
          className="mt-1 w-full border border-border rounded px-3 py-2" />
      </label>
      <label className="block text-sm">Contraseña
        <input name="password" type="password" required
          className="mt-1 w-full border border-border rounded px-3 py-2" />
      </label>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <button type="submit" disabled={pending}
        className="w-full bg-primary text-primary-foreground rounded py-2 disabled:opacity-60">
        {pending ? 'Ingresando…' : 'Ingresar'}
      </button>
    </form>
  )
}
```

- [ ] **Step 9: Verificación manual**

Run: `pnpm dev`, ir a `/login`, ingresar con `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`.
Expected: redirige a `/deposito` (404 por ahora, es esperado). Cookie `session` presente. Ir a `/productos` sin sesión → redirige a `/login`.

- [ ] **Step 10: Commit**

```bash
git add -A && git commit -m "feat: login (signIn/signOut) + página de ingreso + helper de DB de test"
```

---

### Task 7: App shell — layout protegido, sidebar y redirección raíz

**Files:**
- Create: `src/app/(app)/layout.tsx`
- Create: `src/app/(app)/page.tsx`
- Create: `src/components/layout/Sidebar.tsx`
- Create: `src/components/layout/Header.tsx`
- Create: `src/components/layout/NavLink.tsx`
- Test: `src/components/layout/NavLink.test.tsx`

**Interfaces:**
- Consumes: `requireUser` (Task 5), `signOut` (Task 6)
- Produces:
  - `<Sidebar role={RoleName} />` — nav: Depósito, Carga inicial, Productos, Categorías, (Usuarios solo `ADMIN`)
  - `<Header userName={string} />` — nombre + botón "Salir" (`<form action={signOut}>`)
  - `<NavLink href={string} label={string} icon={LucideIcon} />` — marca activo con `usePathname()`

- [ ] **Step 1: Test que falla — `src/components/layout/NavLink.test.tsx`**

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Home } from 'lucide-react'

vi.mock('next/navigation', () => ({ usePathname: () => '/deposito' }))
import { NavLink } from './NavLink'

describe('NavLink', () => {
  it('marca aria-current cuando la ruta coincide', () => {
    render(<NavLink href="/deposito" label="Depósito" icon={Home} />)
    expect(screen.getByRole('link', { name: 'Depósito' })).toHaveAttribute('aria-current', 'page')
  })
  it('no marca aria-current en otra ruta', () => {
    render(<NavLink href="/productos" label="Productos" icon={Home} />)
    expect(screen.getByRole('link', { name: 'Productos' })).not.toHaveAttribute('aria-current')
  })
})
```

- [ ] **Step 2: Ejecutar — debe fallar**

Run: `pnpm test src/components/layout/NavLink.test.tsx` → FAIL.

- [ ] **Step 3: Implementar `src/components/layout/NavLink.tsx`**

```tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

export function NavLink({ href, label, icon: Icon }: { href: string; label: string; icon: LucideIcon }) {
  const pathname = usePathname()
  const active = pathname === href || pathname.startsWith(href + '/')
  return (
    <Link href={href} aria-current={active ? 'page' : undefined}
      className={cn('flex items-center gap-2 rounded px-3 py-2 text-sm',
        active ? 'bg-primary text-primary-foreground' : 'hover:bg-border/50')}>
      <Icon size={16} /> {label}
    </Link>
  )
}
```

- [ ] **Step 4: Ejecutar — debe pasar**

Run: `pnpm test src/components/layout/NavLink.test.tsx` → PASS.

- [ ] **Step 5: `src/components/layout/Sidebar.tsx`**

```tsx
import { Boxes, ClipboardList, Package, Tags, Users } from 'lucide-react'
import type { RoleName } from '@/lib/constants'
import { NavLink } from './NavLink'

export function Sidebar({ role }: { role: RoleName }) {
  return (
    <nav className="w-56 shrink-0 border-r border-border p-3 space-y-1">
      <NavLink href="/deposito" label="Depósito" icon={Boxes} />
      <NavLink href="/carga-inicial" label="Carga inicial" icon={ClipboardList} />
      <NavLink href="/productos" label="Productos" icon={Package} />
      <NavLink href="/categorias" label="Categorías" icon={Tags} />
      {role === 'ADMIN' && <NavLink href="/usuarios" label="Usuarios" icon={Users} />}
    </nav>
  )
}
```

- [ ] **Step 6: `src/components/layout/Header.tsx`**

```tsx
import { signOut } from '@/server/actions/auth'

export function Header({ userName }: { userName: string }) {
  return (
    <header className="h-14 border-b border-border flex items-center justify-between px-4">
      <span className="font-semibold">Gestión</span>
      <div className="flex items-center gap-3 text-sm">
        <span className="text-muted">{userName}</span>
        <form action={signOut}><button className="underline">Salir</button></form>
      </div>
    </header>
  )
}
```

- [ ] **Step 7: `src/app/(app)/layout.tsx`**

```tsx
import { requireUser } from '@/server/auth/guards'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'

export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const session = await requireUser()
  return (
    <div className="min-h-full flex flex-col">
      <Header userName={session.name} />
      <div className="flex flex-1">
        <Sidebar role={session.role} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
```

- [ ] **Step 8: `src/app/(app)/page.tsx`** — redirección raíz

```tsx
import { redirect } from 'next/navigation'
export default function IndexPage() { redirect('/deposito') }
```

- [ ] **Step 9: Eliminar la home de Create Next App**

Borrar `src/app/page.tsx` (la ruta `/` ahora la cubre `(app)/page.tsx`).

- [ ] **Step 10: Verificar**

Run: `pnpm test && pnpm build && pnpm dev` — con sesión, `/` redirige a `/deposito`; el sidebar muestra "Usuarios" solo si el usuario es ADMIN; "Salir" borra la sesión.

- [ ] **Step 11: Commit**

```bash
git add -A && git commit -m "feat: app shell (layout protegido, sidebar, header, redirección raíz)"
```

---

## Phase 2 — Primitivas de UI

### Task 8: Componentes UI base

**Files:**
- Create: `src/components/ui/button.tsx`, `input.tsx`, `select.tsx`, `dialog.tsx`, `badge.tsx`, `table.tsx`, `toast.tsx`
- Test: `src/components/ui/button.test.tsx`

**Interfaces:**
- Produces (todas aceptan `className` y hacen merge con `cn`):
  - `<Button variant?: 'primary' | 'ghost' | 'danger'; size?: 'sm' | 'md' />` (extiende `button` props)
  - `<Input />` (extiende `input` props)
  - `<Select />` wrapper de `@radix-ui/react-select` con API `{ value, onValueChange, options: {value,label}[], placeholder? }`
  - `<Dialog open onOpenChange title children />` wrapper de `@radix-ui/react-dialog`
  - `<Badge tone?: 'neutral' | 'success' | 'danger' />`
  - `<Table>`, `<Thead>`, `<Tbody>`, `<Tr>`, `<Th sortable? sorted?: 'asc'|'desc'|false onSort? >`, `<Td>`
  - `<ToastProvider>` + `useToast(): { toast: (msg: string, tone?: 'success'|'danger') => void }`

- [ ] **Step 1: Test que falla — `src/components/ui/button.test.tsx`**

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from './button'

describe('Button', () => {
  it('renderiza el texto y dispara onClick', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Guardar</Button>)
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(onClick).toHaveBeenCalledOnce()
  })
  it('respeta disabled', async () => {
    const onClick = vi.fn()
    render(<Button disabled onClick={onClick}>X</Button>)
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Ejecutar — debe fallar.** Run: `pnpm test src/components/ui/button.test.tsx` → FAIL.

- [ ] **Step 3: Implementar `src/components/ui/button.tsx`**

```tsx
import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
}

const variants = {
  primary: 'bg-primary text-primary-foreground hover:opacity-90',
  ghost: 'hover:bg-border/50',
  danger: 'bg-danger text-white hover:opacity-90',
}
const sizes = { sm: 'px-2 py-1 text-xs', md: 'px-3 py-2 text-sm' }

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => (
    <button ref={ref}
      className={cn('rounded font-medium disabled:opacity-60 disabled:pointer-events-none',
        variants[variant], sizes[size], className)}
      {...props} />
  ),
)
Button.displayName = 'Button'
```

- [ ] **Step 4: Ejecutar — debe pasar.** Run: `pnpm test src/components/ui/button.test.tsx` → PASS.

- [ ] **Step 5: Implementar el resto de primitivas** (sin tests dedicados salvo que tengan lógica; son presentacionales). Guías:
  - `input.tsx`: `forwardRef` sobre `<input>`, clase base `border border-border rounded px-3 py-2 text-sm w-full`.
  - `badge.tsx`: `<span>` con clases según `tone` (`neutral`→gris, `success`→verde, `danger`→rojo).
  - `table.tsx`: wrappers finos sobre `<table>/<thead>/...`; `Th` con `sortable` renderiza un `<button>` con `aria-sort` y `onSort`.
  - `select.tsx`: `Select.Root/Trigger/Value/Portal/Content/Viewport/Item` de Radix, envueltos en un componente controlado con la API indicada arriba.
  - `dialog.tsx`: `Dialog.Root/Portal/Overlay/Content/Title/Close` de Radix; `Content` centrado con overlay semitransparente.
  - `toast.tsx`: `ToastProvider` monta `Toast.Provider/Viewport` de Radix; `useToast` expone `toast(msg, tone)` que agrega a un estado local de toasts.

- [ ] **Step 6: Montar `<ToastProvider>` en `src/app/(app)/layout.tsx`** envolviendo `{children}`.

- [ ] **Step 7: Verificar.** Run: `pnpm test && pnpm build` → PASS / OK.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: primitivas de UI (Button, Input, Select, Dialog, Badge, Table, Toast)"
```

---

## Phase 3 — Categorías

### Task 9: Queries y acciones de categorías

**Files:**
- Create: `src/server/validation/category.ts`
- Create: `src/server/queries/categories.ts`
- Create: `src/server/actions/categories.ts`
- Test: `src/server/actions/categories.test.ts`

**Interfaces:**
- Consumes: `prisma`, `requireUser`, `requireRole`, `resetDb`
- Produces:
  - `slugify(s: string): string` (exportado desde `src/lib/format.ts` — **mover** la función del seed acá y que el seed la importe)
  - `categorySchema` (zod): `{ name: z.string().trim().min(2).max(60) }`
  - `listCategories(): Promise<Array<Category & { activeProductCount: number }>>` — no archivadas, orden por `name`
  - `listCategoryOptions(): Promise<{ value: string; label: string }[]>` — para selects (no archivadas)
  - `createCategory(_prev, formData): Promise<ActionResult>` — `ADMIN`; error si nombre duplicado
  - `updateCategory(id, formData): Promise<ActionResult>` — `ADMIN`
  - `archiveCategory(id): Promise<ActionResult>` — `ADMIN`; rechaza si hay productos activos
  - `type ActionResult = { ok: true } | { ok: false; error: string }`

- [ ] **Step 1: Mover `slugify` a `src/lib/format.ts`** y exportarla; actualizar `prisma/seed.ts` para importarla. (`slugify` no usa APIs de Next, es segura de compartir.)

```ts
export function slugify(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}
```

- [ ] **Step 2: `src/server/validation/category.ts`**

```ts
import { z } from 'zod'
export const categorySchema = z.object({
  name: z.string().trim().min(2, 'Mínimo 2 caracteres').max(60, 'Máximo 60 caracteres'),
})
```

- [ ] **Step 3: Test que falla — `src/server/actions/categories.test.ts`**

```ts
import { describe, expect, it, beforeEach, vi } from 'vitest'
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/server/auth/guards', () => ({
  requireUser: vi.fn().mockResolvedValue({ sub: 'u1', role: 'ADMIN', name: 'A' }),
  requireRole: vi.fn().mockResolvedValue({ sub: 'u1', role: 'ADMIN', name: 'A' }),
}))
import { prisma, resetDb } from '@/test/db'
import { createCategory, archiveCategory } from './categories'
import { listCategories } from '@/server/queries/categories'

beforeEach(async () => { await resetDb() })
const fd = (name: string) => { const f = new FormData(); f.set('name', name); return f }

describe('createCategory', () => {
  it('crea con slug generado', async () => {
    expect(await createCategory(undefined, fd('Sillones Premium'))).toEqual({ ok: true })
    const cats = await listCategories()
    expect(cats[0]).toMatchObject({ name: 'Sillones Premium', slug: 'sillones-premium', activeProductCount: 0 })
  })
  it('rechaza nombre duplicado', async () => {
    await createCategory(undefined, fd('Mesas'))
    expect(await createCategory(undefined, fd('Mesas'))).toEqual({ ok: false, error: 'Ya existe una categoría con ese nombre' })
  })
})

describe('archiveCategory', () => {
  it('rechaza si tiene productos activos', async () => {
    await createCategory(undefined, fd('Mesas'))
    const cat = (await listCategories())[0]
    await prisma.product.create({ data: { name: 'Mesa Roble', categoryId: cat.id } })
    expect(await archiveCategory(cat.id)).toEqual({ ok: false, error: 'No se puede archivar: tiene productos activos' })
  })
  it('archiva si no tiene productos activos', async () => {
    await createCategory(undefined, fd('Mesas'))
    const cat = (await listCategories())[0]
    expect(await archiveCategory(cat.id)).toEqual({ ok: true })
    expect(await listCategories()).toHaveLength(0)
  })
})
```

- [ ] **Step 4: Ejecutar — debe fallar.** Run: `pnpm test src/server/actions/categories.test.ts` → FAIL.

- [ ] **Step 5: `src/server/queries/categories.ts`**

```ts
import 'server-only'
import { prisma } from '@/server/db'

export async function listCategories() {
  const rows = await prisma.category.findMany({
    where: { archivedAt: null },
    orderBy: { name: 'asc' },
    include: { _count: { select: { products: { where: { archivedAt: null } } } } },
  })
  return rows.map(({ _count, ...c }) => ({ ...c, activeProductCount: _count.products }))
}

export async function listCategoryOptions() {
  const rows = await prisma.category.findMany({ where: { archivedAt: null }, orderBy: { name: 'asc' } })
  return rows.map((c) => ({ value: c.id, label: c.name }))
}
```

- [ ] **Step 6: `src/server/actions/categories.ts`**

```ts
'use server'
import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { prisma } from '@/server/db'
import { requireRole } from '@/server/auth/guards'
import { slugify } from '@/lib/format'
import { categorySchema } from '@/server/validation/category'

export type ActionResult = { ok: true } | { ok: false; error: string }

export async function createCategory(_prev: unknown, formData: FormData): Promise<ActionResult> {
  await requireRole('ADMIN')
  const parsed = categorySchema.safeParse({ name: formData.get('name') })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  try {
    await prisma.category.create({ data: { name: parsed.data.name, slug: slugify(parsed.data.name) } })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
      return { ok: false, error: 'Ya existe una categoría con ese nombre' }
    throw e
  }
  revalidatePath('/categorias')
  return { ok: true }
}

export async function updateCategory(id: string, formData: FormData): Promise<ActionResult> {
  await requireRole('ADMIN')
  const parsed = categorySchema.safeParse({ name: formData.get('name') })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  try {
    await prisma.category.update({ where: { id }, data: { name: parsed.data.name, slug: slugify(parsed.data.name) } })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
      return { ok: false, error: 'Ya existe una categoría con ese nombre' }
    throw e
  }
  revalidatePath('/categorias')
  return { ok: true }
}

export async function archiveCategory(id: string): Promise<ActionResult> {
  await requireRole('ADMIN')
  const activos = await prisma.product.count({ where: { categoryId: id, archivedAt: null } })
  if (activos > 0) return { ok: false, error: 'No se puede archivar: tiene productos activos' }
  await prisma.category.update({ where: { id }, data: { archivedAt: new Date() } })
  revalidatePath('/categorias')
  return { ok: true }
}
```

- [ ] **Step 7: Ejecutar — debe pasar.** Run: `pnpm test src/server/actions/categories.test.ts` → PASS.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: queries y acciones de categorías (ABM + guardas de archivado)"
```

---

### Task 10: Página `/categorias`

**Files:**
- Create: `src/app/(app)/categorias/page.tsx`
- Create: `src/components/forms/CategoryManager.tsx` (Client)
- Test: `src/components/forms/CategoryManager.test.tsx`

**Interfaces:**
- Consumes: `listCategories` (Task 9), `createCategory`/`updateCategory`/`archiveCategory`, `useToast`
- Produces: UI de ABM inline (alta arriba, tabla con editar/archivar por fila)

- [ ] **Step 1: Test que falla — `src/components/forms/CategoryManager.test.tsx`**

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const createCategory = vi.fn().mockResolvedValue({ ok: true })
vi.mock('@/server/actions/categories', () => ({ createCategory, updateCategory: vi.fn(), archiveCategory: vi.fn() }))
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
import { CategoryManager } from './CategoryManager'

describe('CategoryManager', () => {
  it('muestra las categorías recibidas', () => {
    render(<CategoryManager categories={[{ id: '1', name: 'Mesas', slug: 'mesas', activeProductCount: 3, archivedAt: null, createdAt: new Date(), updatedAt: new Date() }]} />)
    expect(screen.getByText('Mesas')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })
  it('envía el alta con el nombre tipeado', async () => {
    render(<CategoryManager categories={[]} />)
    await userEvent.type(screen.getByLabelText('Nueva categoría'), 'Sillas')
    await userEvent.click(screen.getByRole('button', { name: 'Agregar' }))
    expect(createCategory).toHaveBeenCalled()
    const formData = createCategory.mock.calls[0][1] as FormData
    expect(formData.get('name')).toBe('Sillas')
  })
})
```

- [ ] **Step 2: Ejecutar — debe fallar.** Run: `pnpm test src/components/forms/CategoryManager.test.tsx` → FAIL.

- [ ] **Step 3: Implementar `CategoryManager.tsx`** — form de alta (`<form action={...}>` con `createCategory.bind(null, undefined)` o wrapper que arme `FormData`), tabla con nombre / `activeProductCount` / acciones. Editar abre un `Dialog` con `Input`; archivar llama `archiveCategory(id)` y muestra `toast` con el `error` si `ok === false`.

- [ ] **Step 4: Ejecutar — debe pasar.** Run: `pnpm test src/components/forms/CategoryManager.test.tsx` → PASS.

- [ ] **Step 5: `src/app/(app)/categorias/page.tsx`**

```tsx
import { listCategories } from '@/server/queries/categories'
import { CategoryManager } from '@/components/forms/CategoryManager'

export default async function CategoriasPage() {
  const categories = await listCategories()
  return (
    <section className="max-w-2xl">
      <h1 className="text-xl font-semibold mb-4">Categorías</h1>
      <CategoryManager categories={categories} />
    </section>
  )
}
```

- [ ] **Step 6: Verificación manual.** `pnpm dev` → `/categorias`: se ven las 6 del seed; alta, edición y archivado funcionan; archivar una con productos muestra el error.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: página /categorias con ABM inline"
```

---

## Phase 4 — Productos y variantes

### Task 11: Validación y helpers puros de producto/variante

**Files:**
- Create: `src/server/validation/product.ts`
- Create: `src/server/validation/variant.ts`
- Create: `src/lib/pricing.ts`
- Test: `src/lib/pricing.test.ts`

**Interfaces:**
- Produces:
  - `productSchema` (zod): `{ name: string.trim().min(2).max(120), categoryId: string.uuid, description: string.trim().max(500).optional().nullable, defaultCost: moneyField, defaultPrice: moneyField }` donde `moneyField = z.coerce.number().min(0).nullable()` con `''`→`null`
  - `variantSchema` (zod): `{ name: string.trim().max(120).optional(), medida/tela/color: string.trim().max(60).optional().nullable, cost: moneyField, price: moneyField, sku: string.trim().max(60).optional().nullable }`
  - `effectiveCost(variant: {cost}, product: {defaultCost}): number | null`
  - `effectivePrice(variant: {price}, product: {defaultPrice}): number | null`
  - `variantDisplayName(v: { name?: string|null; medida?: string|null; tela?: string|null; color?: string|null }): string` — usa `name` si viene; si no, junta `medida · tela · color` (no vacíos) con `' · '`; si todo vacío → `'Única'`
  - `toNumber(d: Prisma.Decimal | number | null | undefined): number | null` — helper para pasar `Decimal` a number

- [ ] **Step 1: Test que falla — `src/lib/pricing.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { effectiveCost, effectivePrice, variantDisplayName } from './pricing'

describe('effectiveCost / effectivePrice', () => {
  it('usa el valor de la variante si existe', () => {
    expect(effectiveCost({ cost: 100 }, { defaultCost: 80 })).toBe(100)
  })
  it('hereda del producto si la variante es null', () => {
    expect(effectiveCost({ cost: null }, { defaultCost: 80 })).toBe(80)
    expect(effectivePrice({ price: null }, { defaultPrice: 200 })).toBe(200)
  })
  it('devuelve null si ninguno tiene valor', () => {
    expect(effectiveCost({ cost: null }, { defaultCost: null })).toBeNull()
  })
})

describe('variantDisplayName', () => {
  it('usa name si viene', () => {
    expect(variantDisplayName({ name: 'Custom', medida: '2m' })).toBe('Custom')
  })
  it('junta medida · tela · color no vacíos', () => {
    expect(variantDisplayName({ medida: '2 cuerpos', tela: 'Chenille', color: 'Gris' }))
      .toBe('2 cuerpos · Chenille · Gris')
    expect(variantDisplayName({ medida: '2 cuerpos', color: 'Gris' })).toBe('2 cuerpos · Gris')
  })
  it('cae en "Única" si todo está vacío', () => {
    expect(variantDisplayName({})).toBe('Única')
  })
})
```

- [ ] **Step 2: Ejecutar — debe fallar.** Run: `pnpm test src/lib/pricing.test.ts` → FAIL.

- [ ] **Step 3: Implementar `src/lib/pricing.ts`**

```ts
type Num = number | string | null | undefined
const n = (v: Num): number | null => {
  if (v === null || v === undefined || v === '') return null
  const x = typeof v === 'string' ? Number(v) : v
  return Number.isNaN(x) ? null : x
}

export function toNumber(v: Num): number | null { return n(v) }

export function effectiveCost(variant: { cost: Num }, product: { defaultCost: Num }): number | null {
  return n(variant.cost) ?? n(product.defaultCost)
}
export function effectivePrice(variant: { price: Num }, product: { defaultPrice: Num }): number | null {
  return n(variant.price) ?? n(product.defaultPrice)
}

export function variantDisplayName(v: {
  name?: string | null; medida?: string | null; tela?: string | null; color?: string | null
}): string {
  if (v.name && v.name.trim()) return v.name.trim()
  const parts = [v.medida, v.tela, v.color].map((s) => s?.trim()).filter(Boolean)
  return parts.length ? parts.join(' · ') : 'Única'
}
```

- [ ] **Step 4: Ejecutar — debe pasar.** Run: `pnpm test src/lib/pricing.test.ts` → PASS.

- [ ] **Step 5: `src/server/validation/product.ts`** y `variant.ts`

```ts
// product.ts
import { z } from 'zod'
const moneyField = z.preprocess((v) => (v === '' || v == null ? null : v),
  z.coerce.number({ message: 'Monto inválido' }).min(0, 'No puede ser negativo').nullable())

export const productSchema = z.object({
  name: z.string().trim().min(2, 'Mínimo 2 caracteres').max(120),
  categoryId: z.string().uuid('Elegí una categoría'),
  description: z.string().trim().max(500).nullish(),
  defaultCost: moneyField,
  defaultPrice: moneyField,
})
export type ProductInput = z.infer<typeof productSchema>
```

```ts
// variant.ts
import { z } from 'zod'
const moneyField = z.preprocess((v) => (v === '' || v == null ? null : v),
  z.coerce.number({ message: 'Monto inválido' }).min(0).nullable())
const text60 = z.string().trim().max(60).nullish()

export const variantSchema = z.object({
  name: z.string().trim().max(120).optional(),
  medida: text60, tela: text60, color: text60,
  cost: moneyField, price: moneyField,
  sku: z.string().trim().max(60).nullish(),
})
export type VariantInput = z.infer<typeof variantSchema>
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: validación zod y helpers de pricing (costo/precio efectivo, nombre de variante)"
```

---

### Task 12: Queries de productos y variantes

**Files:**
- Create: `src/server/queries/products.ts`
- Test: `src/server/queries/products.test.ts`

**Interfaces:**
- Consumes: `prisma`, `effectiveCost`/`effectivePrice` (Task 11), `resetDb`
- Produces:
  - `listProducts(params: { q?: string; categoryId?: string; page?: number; pageSize?: number }): Promise<{ rows: ProductRow[]; total: number }>` donde `ProductRow = { id, name, categoryName, variantCount, defaultCost: number|null, defaultPrice: number|null }` — solo `archivedAt: null`, orden `name asc`, `pageSize` default 25
  - `getProduct(id: string): Promise<ProductDetail | null>` — incluye `variants` (no archivadas) con sus campos crudos y `stock`
  - `searchProductVariants(q: string, limit?: number): Promise<VariantOption[]>` donde `VariantOption = { variantId, productName, variantName, categoryName }` — busca `q` (≥2) en `product.name` o campos de variante (case-insensitive), solo activos, limit default 20

- [ ] **Step 1: Test que falla — `src/server/queries/products.test.ts`**

```ts
import { describe, expect, it, beforeEach } from 'vitest'
import { prisma, resetDb } from '@/test/db'
import { listProducts, getProduct, searchProductVariants } from './products'

let categoryId: string
beforeEach(async () => {
  await resetDb()
  const c = await prisma.category.create({ data: { name: 'Sillones', slug: 'sillones' } })
  categoryId = c.id
})

describe('listProducts', () => {
  it('lista productos activos con conteo de variantes y nombre de categoría', async () => {
    await prisma.product.create({
      data: { name: 'Sillón Milán', categoryId, defaultCost: 100, defaultPrice: 250,
        variants: { create: [{ name: '2 cuerpos' }, { name: '3 cuerpos' }] } },
    })
    const { rows, total } = await listProducts({})
    expect(total).toBe(1)
    expect(rows[0]).toMatchObject({ name: 'Sillón Milán', categoryName: 'Sillones', variantCount: 2, defaultCost: 100, defaultPrice: 250 })
  })
  it('filtra por q (nombre, case-insensitive) y por categoría', async () => {
    await prisma.product.create({ data: { name: 'Sillón Milán', categoryId } })
    await prisma.product.create({ data: { name: 'Sillón Oslo', categoryId } })
    expect((await listProducts({ q: 'oslo' })).rows).toHaveLength(1)
    expect((await listProducts({ categoryId: 'otro-id' })).rows).toHaveLength(0)
  })
  it('excluye archivados', async () => {
    await prisma.product.create({ data: { name: 'Viejo', categoryId, archivedAt: new Date() } })
    expect((await listProducts({})).total).toBe(0)
  })
})

describe('searchProductVariants', () => {
  it('encuentra por nombre de producto o de variante', async () => {
    await prisma.product.create({
      data: { name: 'Sillón Milán', categoryId, variants: { create: [{ name: '2 cuerpos Chenille' }] } },
    })
    expect(await searchProductVariants('milán')).toHaveLength(1)
    expect((await searchProductVariants('chenille'))[0]).toMatchObject({
      productName: 'Sillón Milán', variantName: '2 cuerpos Chenille', categoryName: 'Sillones',
    })
  })
  it('ignora consultas de menos de 2 caracteres', async () => {
    expect(await searchProductVariants('a')).toEqual([])
  })
})
```

- [ ] **Step 2: Ejecutar — debe fallar.** Run: `pnpm test src/server/queries/products.test.ts` → FAIL.

- [ ] **Step 3: Implementar `src/server/queries/products.ts`**

```ts
import 'server-only'
import { prisma } from '@/server/db'
import { toNumber } from '@/lib/pricing'

export type ProductRow = {
  id: string; name: string; categoryName: string; variantCount: number
  defaultCost: number | null; defaultPrice: number | null
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
      },
    }),
    prisma.product.count({ where }),
  ])
  return {
    rows: rows.map((p): ProductRow => ({
      id: p.id, name: p.name, categoryName: p.category.name, variantCount: p._count.variants,
      defaultCost: toNumber(p.defaultCost), defaultPrice: toNumber(p.defaultPrice),
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

- [ ] **Step 4: Ejecutar — debe pasar.** Run: `pnpm test src/server/queries/products.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: queries de productos (listado con filtros, detalle, búsqueda de variantes)"
```

---

### Task 13: Acciones de productos (alta con variante "Única", edición, archivado)

**Files:**
- Create: `src/server/actions/products.ts`
- Test: `src/server/actions/products.test.ts`

**Interfaces:**
- Consumes: `prisma`, `requireUser`, `productSchema`, `variantSchema`, `variantDisplayName`, `revalidatePath`
- Produces:
  - `type SaveResult = { ok: true; id: string } | { ok: false; error: string }`
  - `createProduct(input: unknown): Promise<SaveResult>` — valida `productSchema` + array opcional `variants` (0..N `variantSchema`). En una transacción: crea `Product`; si `variants` vacío crea una `ProductVariant { isDefault: true, name: 'Única' }`; si no, crea cada una con `name = variantDisplayName(...)`. Error `P2002` → `'Ya existe un producto con ese nombre en la categoría'` o `'Hay variantes con el mismo nombre'`.
  - `updateProduct(id: string, input: unknown): Promise<SaveResult>` — actualiza campos base del producto (no toca variantes).
  - `archiveProduct(id: string): Promise<SaveResult>` — set `archivedAt` en producto y en todas sus variantes activas (transacción).

- [ ] **Step 1: Test que falla — `src/server/actions/products.test.ts`**

```ts
import { describe, expect, it, beforeEach, vi } from 'vitest'
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/server/auth/guards', () => ({
  requireUser: vi.fn().mockResolvedValue({ sub: 'u1', role: 'DEPOSITO', name: 'A' }),
  requireRole: vi.fn().mockResolvedValue({ sub: 'u1', role: 'ADMIN', name: 'A' }),
}))
import { prisma, resetDb } from '@/test/db'
import { createProduct, archiveProduct } from './products'

let categoryId: string
beforeEach(async () => {
  await resetDb()
  categoryId = (await prisma.category.create({ data: { name: 'Mesas', slug: 'mesas' } })).id
})

describe('createProduct', () => {
  it('sin variantes crea una variante "Única" isDefault', async () => {
    const res = await createProduct({ name: 'Mesa Roble', categoryId, defaultCost: 50, defaultPrice: 120 })
    expect(res.ok).toBe(true)
    const p = await prisma.product.findFirstOrThrow({ include: { variants: true } })
    expect(p.variants).toHaveLength(1)
    expect(p.variants[0]).toMatchObject({ name: 'Única', isDefault: true })
  })
  it('con variantes autogenera el nombre desde medida/tela/color', async () => {
    await createProduct({
      name: 'Sillón X', categoryId,
      variants: [{ medida: '2 cuerpos', tela: 'Chenille', color: 'Gris', price: 300 }],
    })
    const v = await prisma.productVariant.findFirstOrThrow()
    expect(v.name).toBe('2 cuerpos · Chenille · Gris')
    expect(v.price?.toString()).toBe('300')
  })
  it('rechaza nombre de producto duplicado en la misma categoría', async () => {
    await createProduct({ name: 'Mesa Roble', categoryId })
    expect(await createProduct({ name: 'Mesa Roble', categoryId }))
      .toEqual({ ok: false, error: 'Ya existe un producto con ese nombre en la categoría' })
  })
})

describe('archiveProduct', () => {
  it('archiva el producto y sus variantes', async () => {
    const { id } = await createProduct({ name: 'Mesa Roble', categoryId }) as { ok: true; id: string }
    expect(await archiveProduct(id)).toEqual({ ok: true, id })
    const p = await prisma.product.findUniqueOrThrow({ where: { id }, include: { variants: true } })
    expect(p.archivedAt).not.toBeNull()
    expect(p.variants.every((v) => v.archivedAt !== null)).toBe(true)
  })
})
```

- [ ] **Step 2: Ejecutar — debe fallar.** Run: `pnpm test src/server/actions/products.test.ts` → FAIL.

- [ ] **Step 3: Implementar `src/server/actions/products.ts`**

```ts
'use server'
import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/server/db'
import { requireUser } from '@/server/auth/guards'
import { productSchema } from '@/server/validation/product'
import { variantSchema } from '@/server/validation/variant'
import { variantDisplayName } from '@/lib/pricing'

export type SaveResult = { ok: true; id: string } | { ok: false; error: string }

const createSchema = productSchema.extend({ variants: z.array(variantSchema).optional() })

export async function createProduct(input: unknown): Promise<SaveResult> {
  await requireUser()
  const parsed = createSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  const { variants, ...base } = parsed.data
  try {
    const product = await prisma.$transaction(async (tx) => {
      const p = await tx.product.create({ data: base })
      if (!variants || variants.length === 0) {
        await tx.productVariant.create({ data: { productId: p.id, name: 'Única', isDefault: true } })
      } else {
        for (const v of variants) {
          await tx.productVariant.create({
            data: {
              productId: p.id, name: variantDisplayName(v),
              medida: v.medida ?? null, tela: v.tela ?? null, color: v.color ?? null,
              cost: v.cost ?? null, price: v.price ?? null, sku: v.sku ?? null,
            },
          })
        }
      }
      return p
    })
    revalidatePath('/productos')
    return { ok: true, id: product.id }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const target = String(e.meta?.target ?? '')
      if (target.includes('productId')) return { ok: false, error: 'Hay variantes con el mismo nombre' }
      return { ok: false, error: 'Ya existe un producto con ese nombre en la categoría' }
    }
    throw e
  }
}

export async function updateProduct(id: string, input: unknown): Promise<SaveResult> {
  await requireUser()
  const parsed = productSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  try {
    await prisma.product.update({ where: { id }, data: parsed.data })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
      return { ok: false, error: 'Ya existe un producto con ese nombre en la categoría' }
    throw e
  }
  revalidatePath('/productos')
  revalidatePath(`/productos/${id}`)
  return { ok: true, id }
}

export async function archiveProduct(id: string): Promise<SaveResult> {
  await requireUser()
  const now = new Date()
  await prisma.$transaction([
    prisma.productVariant.updateMany({ where: { productId: id, archivedAt: null }, data: { archivedAt: now } }),
    prisma.product.update({ where: { id }, data: { archivedAt: now } }),
  ])
  revalidatePath('/productos')
  return { ok: true, id }
}
```

- [ ] **Step 4: Ejecutar — debe pasar.** Run: `pnpm test src/server/actions/products.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: acciones de productos (alta con variante Única, edición, archivado en cascada)"
```

---

### Task 14: Acciones de variantes (alta, edición, archivado con guardas)

**Files:**
- Create: `src/server/actions/variants.ts`
- Test: `src/server/actions/variants.test.ts`

**Interfaces:**
- Consumes: `prisma`, `requireUser`, `variantSchema`, `variantDisplayName`, `revalidatePath`
- Produces:
  - `createVariant(productId: string, input: unknown): Promise<SaveResult>` — `name = input.name || variantDisplayName(input)`; `P2002` → `'Ya existe una variante con ese nombre en el producto'`
  - `updateVariant(id: string, input: unknown): Promise<SaveResult>`
  - `archiveVariant(id: string): Promise<SaveResult>` — rechaza si `stock.quantity > 0` (`'La variante tiene stock'`) o si tiene `transactions` (`'La variante tiene movimientos registrados'`) o si es la última variante activa del producto (`'El producto debe tener al menos una variante'`)

- [ ] **Step 1: Test que falla — `src/server/actions/variants.test.ts`**

```ts
import { describe, expect, it, beforeEach, vi } from 'vitest'
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/server/auth/guards', () => ({
  requireUser: vi.fn().mockResolvedValue({ sub: 'u1', role: 'DEPOSITO', name: 'A' }),
}))
import { prisma, resetDb } from '@/test/db'
import { createVariant, archiveVariant } from './variants'

let productId: string, userId: string
beforeEach(async () => {
  await resetDb()
  const c = await prisma.category.create({ data: { name: 'Mesas', slug: 'mesas' } })
  const p = await prisma.product.create({
    data: { name: 'Mesa', categoryId: c.id, variants: { create: [{ name: 'Única', isDefault: true }] } },
  })
  productId = p.id
  userId = (await prisma.user.create({ data: { email: 'u@u.com', name: 'U', passwordHash: 'x' } })).id
})

describe('createVariant', () => {
  it('autogenera nombre y crea la variante', async () => {
    const res = await createVariant(productId, { medida: '1,40m', color: 'Roble' })
    expect(res.ok).toBe(true)
    expect(await prisma.productVariant.findFirst({ where: { name: '1,40m · Roble' } })).not.toBeNull()
  })
  it('rechaza nombre duplicado en el producto', async () => {
    expect(await createVariant(productId, { name: 'Única' }))
      .toEqual({ ok: false, error: 'Ya existe una variante con ese nombre en el producto' })
  })
})

describe('archiveVariant', () => {
  it('rechaza si tiene stock', async () => {
    const v = await prisma.productVariant.create({ data: { productId, name: 'V2' } })
    await prisma.inventoryStock.create({ data: { variantId: v.id, quantity: 3 } })
    expect(await archiveVariant(v.id)).toEqual({ ok: false, error: 'La variante tiene stock' })
  })
  it('rechaza si tiene movimientos', async () => {
    const v = await prisma.productVariant.create({ data: { productId, name: 'V3' } })
    await prisma.inventoryTransaction.create({
      data: { variantId: v.id, type: 'CARGA_INICIAL', quantityDelta: 0, quantityAfter: 0, userId },
    })
    expect(await archiveVariant(v.id)).toEqual({ ok: false, error: 'La variante tiene movimientos registrados' })
  })
  it('rechaza archivar la última variante activa', async () => {
    const only = await prisma.productVariant.findFirstOrThrow({ where: { productId } })
    expect(await archiveVariant(only.id)).toEqual({ ok: false, error: 'El producto debe tener al menos una variante' })
  })
  it('archiva una variante extra sin stock ni movimientos', async () => {
    const v = await prisma.productVariant.create({ data: { productId, name: 'V4' } })
    expect(await archiveVariant(v.id)).toMatchObject({ ok: true })
  })
})
```

- [ ] **Step 2: Ejecutar — debe fallar.** Run: `pnpm test src/server/actions/variants.test.ts` → FAIL.

- [ ] **Step 3: Implementar `src/server/actions/variants.ts`**

```ts
'use server'
import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { prisma } from '@/server/db'
import { requireUser } from '@/server/auth/guards'
import { variantSchema } from '@/server/validation/variant'
import { variantDisplayName } from '@/lib/pricing'
import type { SaveResult } from './products'

export async function createVariant(productId: string, input: unknown): Promise<SaveResult> {
  await requireUser()
  const parsed = variantSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  const v = parsed.data
  try {
    const created = await prisma.productVariant.create({
      data: {
        productId, name: variantDisplayName(v),
        medida: v.medida ?? null, tela: v.tela ?? null, color: v.color ?? null,
        cost: v.cost ?? null, price: v.price ?? null, sku: v.sku ?? null,
      },
    })
    revalidatePath(`/productos/${productId}`)
    return { ok: true, id: created.id }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
      return { ok: false, error: 'Ya existe una variante con ese nombre en el producto' }
    throw e
  }
}

export async function updateVariant(id: string, input: unknown): Promise<SaveResult> {
  await requireUser()
  const parsed = variantSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  const v = parsed.data
  try {
    const updated = await prisma.productVariant.update({
      where: { id },
      data: {
        name: variantDisplayName(v),
        medida: v.medida ?? null, tela: v.tela ?? null, color: v.color ?? null,
        cost: v.cost ?? null, price: v.price ?? null, sku: v.sku ?? null,
      },
    })
    revalidatePath(`/productos/${updated.productId}`)
    return { ok: true, id }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
      return { ok: false, error: 'Ya existe una variante con ese nombre en el producto' }
    throw e
  }
}

export async function archiveVariant(id: string): Promise<SaveResult> {
  await requireUser()
  const variant = await prisma.productVariant.findUniqueOrThrow({
    where: { id }, include: { stock: true, _count: { select: { transactions: true } } },
  })
  if ((variant.stock?.quantity ?? 0) > 0) return { ok: false, error: 'La variante tiene stock' }
  if (variant._count.transactions > 0) return { ok: false, error: 'La variante tiene movimientos registrados' }
  const activas = await prisma.productVariant.count({ where: { productId: variant.productId, archivedAt: null } })
  if (activas <= 1) return { ok: false, error: 'El producto debe tener al menos una variante' }
  await prisma.productVariant.update({ where: { id }, data: { archivedAt: new Date() } })
  revalidatePath(`/productos/${variant.productId}`)
  return { ok: true, id }
}
```

- [ ] **Step 4: Ejecutar — debe pasar.** Run: `pnpm test src/server/actions/variants.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: acciones de variantes (alta con autonombre, edición, archivado con guardas)"
```

---

### Task 15: Página `/productos` (listado + búsqueda + filtro)

**Files:**
- Create: `src/app/(app)/productos/page.tsx`
- Create: `src/components/products/ProductFilters.tsx` (Client)
- Test: `src/components/products/ProductFilters.test.tsx`

**Interfaces:**
- Consumes: `listProducts` (Task 12), `listCategoryOptions` (Task 9), `money`, `integer`
- Produces:
  - `<ProductFilters categories={{value,label}[]} />` — inputs de búsqueda (`q`) y select de categoría; al cambiar, hace `router.push` con `searchParams` (debounce 300 ms en `q`)

- [ ] **Step 1: Test que falla — `src/components/products/ProductFilters.test.tsx`**

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(''),
  usePathname: () => '/productos',
}))
import { ProductFilters } from './ProductFilters'

describe('ProductFilters', () => {
  it('empuja el query param q al tipear (con debounce)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    render(<ProductFilters categories={[]} />)
    await userEvent.type(screen.getByPlaceholderText('Buscar producto…'), 'oslo')
    await vi.advanceTimersByTimeAsync(350)
    expect(push).toHaveBeenCalledWith(expect.stringContaining('q=oslo'))
    vi.useRealTimers()
  })
})
```

- [ ] **Step 2: Ejecutar — debe fallar.** Run: `pnpm test src/components/products/ProductFilters.test.tsx` → FAIL.

- [ ] **Step 3: Implementar `ProductFilters.tsx`** — estado local `q`, `categoryId` inicializados de `useSearchParams()`; `useEffect` con `setTimeout(300)` que construye `URLSearchParams` (omitiendo vacíos) y hace `router.push(\`${pathname}?${params}\`)`.

- [ ] **Step 4: Ejecutar — debe pasar.** Run: `pnpm test src/components/products/ProductFilters.test.tsx` → PASS.

- [ ] **Step 5: Implementar `src/app/(app)/productos/page.tsx`**

```tsx
import Link from 'next/link'
import { listProducts } from '@/server/queries/products'
import { listCategoryOptions } from '@/server/queries/categories'
import { ProductFilters } from '@/components/products/ProductFilters'
import { money } from '@/lib/format'

export default async function ProductosPage({
  searchParams,
}: { searchParams: Promise<{ q?: string; categoryId?: string; page?: string }> }) {
  const sp = await searchParams
  const page = Number(sp.page ?? '1') || 1
  const [{ rows, total }, categories] = await Promise.all([
    listProducts({ q: sp.q, categoryId: sp.categoryId, page }),
    listCategoryOptions(),
  ])
  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Productos ({total})</h1>
        <Link href="/productos/nuevo" className="bg-primary text-primary-foreground rounded px-3 py-2 text-sm">
          Nuevo producto
        </Link>
      </div>
      <ProductFilters categories={categories} />
      <table className="w-full mt-4 text-sm border border-border rounded">
        <thead className="bg-card">
          <tr>
            <th className="text-left p-2">Producto</th><th className="text-left p-2">Categoría</th>
            <th className="text-right p-2">Variantes</th><th className="text-right p-2">Costo sug.</th>
            <th className="text-right p-2">PVP sug.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-t border-border hover:bg-card">
              <td className="p-2"><Link href={`/productos/${p.id}`} className="underline">{p.name}</Link></td>
              <td className="p-2">{p.categoryName}</td>
              <td className="p-2 text-right">{p.variantCount}</td>
              <td className="p-2 text-right">{money(p.defaultCost)}</td>
              <td className="p-2 text-right">{money(p.defaultPrice)}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-muted">Sin resultados</td></tr>}
        </tbody>
      </table>
    </section>
  )
}
```

- [ ] **Step 6: Verificación manual.** `/productos`: buscar filtra en < 500 ms; el filtro de categoría funciona; los filtros quedan en la URL al recargar.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: página /productos con listado, búsqueda y filtro por categoría"
```

---

### Task 16: Formularios de alta y edición de producto

**Files:**
- Create: `src/app/(app)/productos/nuevo/page.tsx`
- Create: `src/app/(app)/productos/[id]/page.tsx`
- Create: `src/components/forms/ProductForm.tsx` (Client)
- Create: `src/components/forms/VariantRows.tsx` (Client)
- Test: `src/components/forms/ProductForm.test.tsx`

**Interfaces:**
- Consumes: `createProduct`/`updateProduct`/`archiveProduct` (Task 13), `createVariant`/`updateVariant`/`archiveVariant` (Task 14), `getProduct` (Task 12), `listCategoryOptions`, `useToast`
- Produces:
  - `<ProductForm mode="create" categories={...} />` — campos base + `<VariantRows>` para agregar filas de variante antes de guardar; al enviar llama `createProduct({...base, variants})` y en `ok` hace `router.push('/productos')`
  - `<ProductForm mode="edit" product={ProductDetail} categories={...} />` — edita base con `updateProduct`; sección de variantes con alta/edición/archivado en vivo (cada una su propia action); botón "Archivar producto"

- [ ] **Step 1: Test que falla — `src/components/forms/ProductForm.test.tsx`**

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const createProduct = vi.fn().mockResolvedValue({ ok: true, id: 'p1' })
const push = vi.fn()
vi.mock('@/server/actions/products', () => ({ createProduct, updateProduct: vi.fn(), archiveProduct: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
import { ProductForm } from './ProductForm'

const cats = [{ value: 'c1', label: 'Mesas' }]

describe('ProductForm (create)', () => {
  it('envía nombre, categoría y variantes agregadas', async () => {
    render(<ProductForm mode="create" categories={cats} />)
    await userEvent.type(screen.getByLabelText('Nombre / Modelo'), 'Mesa Roble')
    await userEvent.selectOptions(screen.getByLabelText('Categoría'), 'c1')
    await userEvent.click(screen.getByRole('button', { name: 'Agregar variante' }))
    await userEvent.type(screen.getByLabelText('Medida (fila 1)'), '1,40m')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar producto' }))
    expect(createProduct).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Mesa Roble', categoryId: 'c1',
      variants: [expect.objectContaining({ medida: '1,40m' })],
    }))
    expect(push).toHaveBeenCalledWith('/productos')
  })
  it('muestra el error de la action sin redirigir', async () => {
    createProduct.mockResolvedValueOnce({ ok: false, error: 'Ya existe un producto con ese nombre en la categoría' })
    render(<ProductForm mode="create" categories={cats} />)
    await userEvent.type(screen.getByLabelText('Nombre / Modelo'), 'Mesa Roble')
    await userEvent.selectOptions(screen.getByLabelText('Categoría'), 'c1')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar producto' }))
    expect(await screen.findByText('Ya existe un producto con ese nombre en la categoría')).toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Ejecutar — debe fallar.** Run: `pnpm test src/components/forms/ProductForm.test.tsx` → FAIL.

- [ ] **Step 3: Implementar `VariantRows.tsx`** — lista controlada de filas `{ medida, tela, color, cost, price, sku }`; botón "Agregar variante" agrega una fila vacía; cada input tiene `aria-label` `"<Campo> (fila <n>)"`; expone el array vía `onChange`.

- [ ] **Step 4: Implementar `ProductForm.tsx`**
  - Estado: campos base + `variants` (de `VariantRows`).
  - `mode="create"`: `onSubmit` → `createProduct({ name, categoryId, description, defaultCost, defaultPrice, variants })`; si `ok` → `router.push('/productos')`; si no → set `error`.
  - `mode="edit"`: campos base con `updateProduct(product.id, {...})`; render de `product.variants` con edición inline (`updateVariant`) y botón archivar (`archiveVariant`, muestra `toast` con el error); form separado "Agregar variante" (`createVariant(product.id, {...})`); botón "Archivar producto" (`archiveProduct`, luego `router.push('/productos')`).

- [ ] **Step 5: Ejecutar — debe pasar.** Run: `pnpm test src/components/forms/ProductForm.test.tsx` → PASS.

- [ ] **Step 6: `src/app/(app)/productos/nuevo/page.tsx`**

```tsx
import { listCategoryOptions } from '@/server/queries/categories'
import { ProductForm } from '@/components/forms/ProductForm'

export default async function NuevoProductoPage() {
  const categories = await listCategoryOptions()
  return (
    <section className="max-w-2xl">
      <h1 className="text-xl font-semibold mb-4">Nuevo producto</h1>
      <ProductForm mode="create" categories={categories} />
    </section>
  )
}
```

- [ ] **Step 7: `src/app/(app)/productos/[id]/page.tsx`**

```tsx
import { notFound } from 'next/navigation'
import { getProduct } from '@/server/queries/products'
import { listCategoryOptions } from '@/server/queries/categories'
import { ProductForm } from '@/components/forms/ProductForm'

export default async function EditarProductoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [product, categories] = await Promise.all([getProduct(id), listCategoryOptions()])
  if (!product) notFound()
  return (
    <section className="max-w-2xl">
      <h1 className="text-xl font-semibold mb-4">{product.name}</h1>
      <ProductForm mode="edit" product={product} categories={categories} />
    </section>
  )
}
```

- [ ] **Step 8: Crear `src/app/(app)/productos/[id]/not-found.tsx`** — mensaje "Producto no encontrado" + link a `/productos`.

- [ ] **Step 9: Verificación manual.** Alta con y sin variantes; la variante "Única" aparece cuando no se cargan variantes; edición de base y de variantes; archivar variante con stock → error; archivar producto → sale del listado.

- [ ] **Step 10: Commit**

```bash
git add -A && git commit -m "feat: formularios de alta y edición de producto + variantes"
```

---

## Phase 5 — Núcleo de inventario

### Task 17: Queries de inventario + script de reconciliación

**Files:**
- Create: `src/server/queries/inventory.ts`
- Create: `prisma/scripts/reconcile.ts`
- Test: `src/server/queries/inventory.test.ts`

**Interfaces:**
- Consumes: `prisma`, `effectiveCost`/`effectivePrice`, `resetDb`
- Produces:
  - `type StockRow = { variantId: string; productName: string; variantName: string; categoryName: string; quantity: number; unitCost: number | null; unitPrice: number | null }`
  - `listStock(params: { q?: string; categoryId?: string; status?: 'todos' | 'disponible' | 'sin_stock'; sort?: 'producto' | 'stock' | 'precio'; dir?: 'asc' | 'desc' }): Promise<{ rows: StockRow[]; totalVariants: number; totalUnits: number }>` — solo variantes/productos no archivados; `quantity` = `stock?.quantity ?? 0`
  - `getVariantStock(variantId: string): Promise<number>` — `0` si no hay `InventoryStock`

- [ ] **Step 1: Test que falla — `src/server/queries/inventory.test.ts`**

```ts
import { describe, expect, it, beforeEach } from 'vitest'
import { prisma, resetDb } from '@/test/db'
import { listStock, getVariantStock } from './inventory'

let vDisponible: string, vSinStock: string
beforeEach(async () => {
  await resetDb()
  const c = await prisma.category.create({ data: { name: 'Sillones', slug: 'sillones' } })
  const p = await prisma.product.create({
    data: {
      name: 'Sillón Milán', categoryId: c.id, defaultCost: 100, defaultPrice: 250,
      variants: {
        create: [
          { name: '2 cuerpos', price: 300 },   // override de precio
          { name: '3 cuerpos' },               // hereda 250
        ],
      },
    },
    include: { variants: true },
  })
  vDisponible = p.variants[0].id
  vSinStock = p.variants[1].id
  await prisma.inventoryStock.create({ data: { variantId: vDisponible, quantity: 5 } })
})

describe('listStock', () => {
  it('devuelve costo/precio efectivo y stock 0 cuando no hay InventoryStock', async () => {
    const { rows, totalVariants, totalUnits } = await listStock({})
    expect(totalVariants).toBe(2)
    expect(totalUnits).toBe(5)
    const r2 = rows.find((r) => r.variantName === '2 cuerpos')!
    expect(r2).toMatchObject({ quantity: 5, unitCost: 100, unitPrice: 300 })
    const r3 = rows.find((r) => r.variantName === '3 cuerpos')!
    expect(r3).toMatchObject({ quantity: 0, unitPrice: 250 })
  })
  it('filtra por estado disponible / sin_stock', async () => {
    expect((await listStock({ status: 'disponible' })).rows.map((r) => r.variantName)).toEqual(['2 cuerpos'])
    expect((await listStock({ status: 'sin_stock' })).rows.map((r) => r.variantName)).toEqual(['3 cuerpos'])
  })
  it('busca por nombre de producto o variante', async () => {
    expect((await listStock({ q: '3 cuerpos' })).rows).toHaveLength(1)
  })
})

describe('getVariantStock', () => {
  it('0 si no existe InventoryStock', async () => {
    expect(await getVariantStock(vSinStock)).toBe(0)
  })
  it('la cantidad si existe', async () => {
    expect(await getVariantStock(vDisponible)).toBe(5)
  })
})
```

- [ ] **Step 2: Ejecutar — debe fallar.** Run: `pnpm test src/server/queries/inventory.test.ts` → FAIL.

- [ ] **Step 3: Implementar `src/server/queries/inventory.ts`**

```ts
import 'server-only'
import { prisma } from '@/server/db'
import { effectiveCost, effectivePrice, toNumber } from '@/lib/pricing'

export type StockRow = {
  variantId: string; productName: string; variantName: string; categoryName: string
  quantity: number; unitCost: number | null; unitPrice: number | null
}

export async function listStock(params: {
  q?: string; categoryId?: string
  status?: 'todos' | 'disponible' | 'sin_stock'
  sort?: 'producto' | 'stock' | 'precio'; dir?: 'asc' | 'desc'
} = {}) {
  const term = params.q?.trim()
  const like = term ? { contains: term, mode: 'insensitive' as const } : undefined
  const variants = await prisma.productVariant.findMany({
    where: {
      archivedAt: null,
      product: { archivedAt: null, ...(params.categoryId ? { categoryId: params.categoryId } : {}) },
      ...(like ? { OR: [{ name: like }, { product: { name: like } }] } : {}),
    },
    include: {
      stock: true,
      product: { select: { name: true, defaultCost: true, defaultPrice: true, category: { select: { name: true } } } },
    },
    orderBy: [{ product: { name: 'asc' } }, { name: 'asc' }],
  })

  let rows: StockRow[] = variants.map((v) => ({
    variantId: v.id, productName: v.product.name, variantName: v.name,
    categoryName: v.product.category.name,
    quantity: v.stock?.quantity ?? 0,
    unitCost: effectiveCost({ cost: toNumber(v.cost) }, { defaultCost: toNumber(v.product.defaultCost) }),
    unitPrice: effectivePrice({ price: toNumber(v.price) }, { defaultPrice: toNumber(v.product.defaultPrice) }),
  }))

  if (params.status === 'disponible') rows = rows.filter((r) => r.quantity > 0)
  else if (params.status === 'sin_stock') rows = rows.filter((r) => r.quantity === 0)

  if (params.sort) {
    const dir = params.dir === 'desc' ? -1 : 1
    rows.sort((a, b) => {
      const [x, y] = params.sort === 'stock' ? [a.quantity, b.quantity]
        : params.sort === 'precio' ? [a.unitPrice ?? 0, b.unitPrice ?? 0]
        : [a.productName.localeCompare(b.productName), 0]
      return (typeof x === 'number' ? x - (y as number) : x) * dir
    })
  }

  return {
    rows,
    totalVariants: rows.length,
    totalUnits: rows.reduce((s, r) => s + r.quantity, 0),
  }
}

export async function getVariantStock(variantId: string): Promise<number> {
  const s = await prisma.inventoryStock.findUnique({ where: { variantId } })
  return s?.quantity ?? 0
}
```

- [ ] **Step 4: Ejecutar — debe pasar.** Run: `pnpm test src/server/queries/inventory.test.ts` → PASS.

- [ ] **Step 5: `prisma/scripts/reconcile.ts`** — para cada variante, comparar `InventoryStock.quantity` contra `SUM(quantityDelta)` de sus `InventoryTransaction`; imprimir las discrepancias. No modifica datos.

```ts
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const variants = await prisma.productVariant.findMany({ include: { stock: true } })
  let issues = 0
  for (const v of variants) {
    const agg = await prisma.inventoryTransaction.aggregate({
      where: { variantId: v.id }, _sum: { quantityDelta: true },
    })
    const ledger = agg._sum.quantityDelta ?? 0
    const snapshot = v.stock?.quantity ?? 0
    if (ledger !== snapshot) {
      issues++
      console.log(`DISCREPANCIA ${v.id} (${v.name}): snapshot=${snapshot} ledger=${ledger}`)
    }
  }
  console.log(issues === 0 ? 'OK: sin discrepancias' : `${issues} discrepancia(s)`)
}
main().then(() => prisma.$disconnect())
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: queries de inventario (listStock con filtros/orden) + script de reconciliación"
```

---

### Task 18: Acción `saveInitialStockBatch` (carga inicial transaccional)

**Files:**
- Create: `src/server/validation/inventory.ts`
- Create: `src/server/actions/inventory.ts`
- Test: `src/server/actions/inventory.test.ts`

**Interfaces:**
- Consumes: `prisma`, `requireUser`, `revalidatePath`
- Produces:
  - `stockRowSchema` (zod): `{ variantId: z.string().uuid(), counted: z.coerce.number().int('Debe ser un entero').min(0, 'No puede ser negativo') }`
  - `batchSchema` = `z.array(stockRowSchema).min(1)`
  - `type BatchRowResult = { variantId: string; ok: true; delta: number; quantityAfter: number } | { variantId: string; ok: false; error: string }`
  - `type BatchResult = { batchId: string; saved: number; failed: number; results: BatchRowResult[] }`
  - `saveInitialStockBatch(rows: unknown): Promise<BatchResult>` — valida cada fila; descarta las inválidas con su error; para las válidas ejecuta **una** `prisma.$transaction`: por fila lee `InventoryStock` actual (0 si no existe), calcula `delta = counted - actual`, hace `upsert` de `InventoryStock.quantity = counted` y crea `InventoryTransaction { type: 'CARGA_INICIAL', quantityDelta: delta, quantityAfter: counted, userId, batchId }` (mismo `batchId` uuid para todo el lote). Si la transacción falla, ninguna fila se persiste y todas las válidas se devuelven con `ok:false, error:'No se pudo guardar el lote'`.

- [ ] **Step 1: Test que falla — `src/server/actions/inventory.test.ts`**

```ts
import { describe, expect, it, beforeEach, vi } from 'vitest'
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/server/auth/guards', () => ({
  requireUser: vi.fn().mockResolvedValue({ sub: 'USER_ID', role: 'DEPOSITO', name: 'Ana' }),
}))
import { prisma, resetDb } from '@/test/db'
import { saveInitialStockBatch } from './inventory'

let v1: string, v2: string, userId: string
beforeEach(async () => {
  await resetDb()
  userId = (await prisma.user.create({ data: { email: 'a@a.com', name: 'Ana', passwordHash: 'x' } })).id
  ;(await import('@/server/auth/guards')).requireUser.mockResolvedValue({ sub: userId, role: 'DEPOSITO', name: 'Ana' })
  const c = await prisma.category.create({ data: { name: 'Mesas', slug: 'mesas' } })
  const p = await prisma.product.create({
    data: { name: 'Mesa', categoryId: c.id, variants: { create: [{ name: 'A' }, { name: 'B' }] } },
    include: { variants: true },
  })
  v1 = p.variants[0].id; v2 = p.variants[1].id
  await prisma.inventoryStock.create({ data: { variantId: v1, quantity: 3 } })
})

describe('saveInitialStockBatch', () => {
  it('ajuste absoluto: el stock queda en lo contado y registra el delta', async () => {
    const res = await saveInitialStockBatch([{ variantId: v1, counted: 8 }, { variantId: v2, counted: 4 }])
    expect(res.saved).toBe(2)
    expect(res.failed).toBe(0)
    expect(await prisma.inventoryStock.findUniqueOrThrow({ where: { variantId: v1 } })).toMatchObject({ quantity: 8 })
    expect(await prisma.inventoryStock.findUniqueOrThrow({ where: { variantId: v2 } })).toMatchObject({ quantity: 4 })
    const t1 = await prisma.inventoryTransaction.findFirstOrThrow({ where: { variantId: v1 } })
    expect(t1).toMatchObject({ type: 'CARGA_INICIAL', quantityDelta: 5, quantityAfter: 8, userId })
    const t2 = await prisma.inventoryTransaction.findFirstOrThrow({ where: { variantId: v2 } })
    expect(t2).toMatchObject({ quantityDelta: 4, quantityAfter: 4 })
    expect(t1.batchId).toBe(t2.batchId)
    expect(t1.batchId).not.toBeNull()
  })
  it('descarta filas inválidas y guarda las válidas', async () => {
    const res = await saveInitialStockBatch([
      { variantId: v1, counted: 10 },
      { variantId: v2, counted: -2 },
      { variantId: 'no-uuid', counted: 1 },
    ])
    expect(res.saved).toBe(1)
    expect(res.failed).toBe(2)
    expect(res.results.filter((r) => !r.ok).map((r) => r.error)).toContain('No puede ser negativo')
    expect(await prisma.inventoryStock.findUniqueOrThrow({ where: { variantId: v1 } })).toMatchObject({ quantity: 10 })
  })
  it('recontar registra un segundo movimiento con el nuevo delta', async () => {
    await saveInitialStockBatch([{ variantId: v1, counted: 8 }])   // delta +5, after 8
    await saveInitialStockBatch([{ variantId: v1, counted: 6 }])   // delta -2, after 6
    const ts = await prisma.inventoryTransaction.findMany({ where: { variantId: v1 }, orderBy: { createdAt: 'asc' } })
    expect(ts.map((t) => [t.quantityDelta, t.quantityAfter])).toEqual([[5, 8], [-2, 6]])
    expect(await prisma.inventoryStock.findUniqueOrThrow({ where: { variantId: v1 } })).toMatchObject({ quantity: 6 })
  })
  it('rechaza un lote vacío', async () => {
    await expect(saveInitialStockBatch([])).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Ejecutar — debe fallar.** Run: `pnpm test src/server/actions/inventory.test.ts` → FAIL.

- [ ] **Step 3: Implementar `src/server/validation/inventory.ts`**

```ts
import { z } from 'zod'

export const stockRowSchema = z.object({
  variantId: z.string().uuid('Variante inválida'),
  counted: z.coerce.number().int('Debe ser un entero').min(0, 'No puede ser negativo'),
})
export const batchSchema = z.array(stockRowSchema).min(1, 'El lote está vacío')

export const adjustSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.coerce.number().int('Debe ser un entero').min(0, 'No puede ser negativo'),
  note: z.string().trim().min(1, 'El motivo es obligatorio').max(300),
})
```

- [ ] **Step 4: Implementar `src/server/actions/inventory.ts`**

```ts
'use server'
import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/server/db'
import { requireUser } from '@/server/auth/guards'
import { stockRowSchema, batchSchema, adjustSchema } from '@/server/validation/inventory'

export type BatchRowResult =
  | { variantId: string; ok: true; delta: number; quantityAfter: number }
  | { variantId: string; ok: false; error: string }

export type BatchResult = { batchId: string; saved: number; failed: number; results: BatchRowResult[] }

export async function saveInitialStockBatch(rows: unknown): Promise<BatchResult> {
  const session = await requireUser()
  const asArray = z.array(z.unknown()).min(1, 'El lote está vacío').parse(rows)

  const valid: { variantId: string; counted: number }[] = []
  const results: BatchRowResult[] = []
  for (const raw of asArray) {
    const parsed = stockRowSchema.safeParse(raw)
    if (parsed.success) valid.push(parsed.data)
    else {
      const vid = (raw as { variantId?: string })?.variantId ?? 'desconocida'
      results.push({ variantId: vid, ok: false, error: parsed.error.issues[0].message })
    }
  }

  const batchId = randomUUID()

  if (valid.length > 0) {
    try {
      const applied = await prisma.$transaction(async (tx) => {
        const out: BatchRowResult[] = []
        for (const row of valid) {
          const current = await tx.inventoryStock.findUnique({ where: { variantId: row.variantId } })
          const before = current?.quantity ?? 0
          const delta = row.counted - before
          await tx.inventoryStock.upsert({
            where: { variantId: row.variantId },
            update: { quantity: row.counted },
            create: { variantId: row.variantId, quantity: row.counted },
          })
          await tx.inventoryTransaction.create({
            data: {
              variantId: row.variantId, type: 'CARGA_INICIAL',
              quantityDelta: delta, quantityAfter: row.counted,
              userId: session.sub, batchId,
            },
          })
          out.push({ variantId: row.variantId, ok: true, delta, quantityAfter: row.counted })
        }
        return out
      })
      results.push(...applied)
    } catch {
      for (const row of valid) {
        results.push({ variantId: row.variantId, ok: false, error: 'No se pudo guardar el lote' })
      }
    }
  }

  // Mantener el orden de entrada
  const order = new Map(asArray.map((r, i) => [(r as { variantId?: string })?.variantId, i]))
  results.sort((a, b) => (order.get(a.variantId) ?? 0) - (order.get(b.variantId) ?? 0))

  const saved = results.filter((r) => r.ok).length
  if (saved > 0) {
    revalidatePath('/deposito')
    revalidatePath('/carga-inicial')
  }
  return { batchId, saved, failed: results.length - saved, results }
}
```

- [ ] **Step 5: Ejecutar — debe pasar.** Run: `pnpm test src/server/actions/inventory.test.ts` → PASS.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: saveInitialStockBatch (carga inicial transaccional, ajuste absoluto con delta)"
```

---

### Task 19: Acción `adjustStock` (movimiento AJUSTE)

**Files:**
- Modify: `src/server/actions/inventory.ts` (agregar `adjustStock`)
- Test: `src/server/actions/inventory.test.ts` (agregar `describe('adjustStock')`)

**Interfaces:**
- Consumes: `adjustSchema` (Task 18), `prisma`, `requireUser`
- Produces:
  - `adjustStock(input: unknown): Promise<{ ok: true; delta: number; quantityAfter: number } | { ok: false; error: string }>` — valida `adjustSchema`; en `$transaction` calcula `delta = quantity - actual`, `upsert` de `InventoryStock`, crea `InventoryTransaction { type: 'AJUSTE', note, userId }`. Motivo vacío o cantidad negativa → error de validación.

- [ ] **Step 1: Agregar el test que falla**

```ts
import { adjustStock } from './inventory'

describe('adjustStock', () => {
  it('registra un AJUSTE con motivo y actualiza el stock', async () => {
    const res = await adjustStock({ variantId: v1, quantity: 1, note: 'Rotura en depósito' })
    expect(res).toMatchObject({ ok: true, delta: -2, quantityAfter: 1 })
    const t = await prisma.inventoryTransaction.findFirstOrThrow({ where: { variantId: v1, type: 'AJUSTE' } })
    expect(t).toMatchObject({ note: 'Rotura en depósito', quantityDelta: -2, quantityAfter: 1 })
  })
  it('rechaza motivo vacío', async () => {
    expect(await adjustStock({ variantId: v1, quantity: 2, note: '' }))
      .toEqual({ ok: false, error: 'El motivo es obligatorio' })
  })
  it('rechaza cantidad negativa', async () => {
    expect(await adjustStock({ variantId: v1, quantity: -1, note: 'x' }))
      .toEqual({ ok: false, error: 'No puede ser negativo' })
  })
})
```

- [ ] **Step 2: Ejecutar — debe fallar.** Run: `pnpm test src/server/actions/inventory.test.ts -t adjustStock` → FAIL.

- [ ] **Step 3: Implementar `adjustStock` en `src/server/actions/inventory.ts`**

```ts
export async function adjustStock(input: unknown) {
  const session = await requireUser()
  const parsed = adjustSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message }
  const { variantId, quantity, note } = parsed.data

  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.inventoryStock.findUnique({ where: { variantId } })
    const before = current?.quantity ?? 0
    const delta = quantity - before
    await tx.inventoryStock.upsert({
      where: { variantId }, update: { quantity }, create: { variantId, quantity },
    })
    await tx.inventoryTransaction.create({
      data: { variantId, type: 'AJUSTE', quantityDelta: delta, quantityAfter: quantity, note, userId: session.sub },
    })
    return { delta, quantityAfter: quantity }
  })
  revalidatePath('/deposito')
  return { ok: true as const, ...result }
}
```

- [ ] **Step 4: Ejecutar — debe pasar.** Run: `pnpm test src/server/actions/inventory.test.ts` → PASS (todo el archivo).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: adjustStock (movimiento AJUSTE con motivo obligatorio)"
```

---

## Phase 6 — Grilla de carga rápida

### Task 20: Route handler `/api/search` (autocompletar variantes)

**Files:**
- Create: `src/app/api/search/route.ts`
- Create: `src/app/api/health/route.ts`
- Test: `src/app/api/search/route.test.ts`

**Interfaces:**
- Consumes: `searchProductVariants` (Task 12), `requireUser` (Task 5)
- Produces:
  - `GET /api/search?q=<term>` → `200` con `{ results: VariantOption[] }`; `q` de menos de 2 chars → `{ results: [] }`. Sin sesión → `proxy` ya redirige, pero la ruta igual llama `requireUser()` (defensa en profundidad; en test se mockea).
  - `GET /api/health` → `200 { ok: true }` si `SELECT 1` responde; `503` si no. Ruta pública (listada en `proxy.ts`).

- [ ] **Step 1: Test que falla — `src/app/api/search/route.test.ts`**

```ts
import { describe, expect, it, beforeEach, vi } from 'vitest'
vi.mock('@/server/auth/guards', () => ({ requireUser: vi.fn().mockResolvedValue({ sub: 'u1' }) }))
import { prisma, resetDb } from '@/test/db'
import { GET } from './route'

beforeEach(async () => {
  await resetDb()
  const c = await prisma.category.create({ data: { name: 'Sillones', slug: 'sillones' } })
  await prisma.product.create({
    data: { name: 'Sillón Milán', categoryId: c.id, variants: { create: [{ name: '2 cuerpos' }] } },
  })
})

const req = (q: string) => new Request(`http://localhost/api/search?q=${encodeURIComponent(q)}`)

describe('GET /api/search', () => {
  it('devuelve coincidencias', async () => {
    const res = await GET(req('milán'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.results[0]).toMatchObject({ productName: 'Sillón Milán', variantName: '2 cuerpos' })
  })
  it('q corta → results vacío', async () => {
    const body = await (await GET(req('a'))).json()
    expect(body.results).toEqual([])
  })
})
```

- [ ] **Step 2: Ejecutar — debe fallar.** Run: `pnpm test src/app/api/search/route.test.ts` → FAIL.

- [ ] **Step 3: Implementar `src/app/api/search/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { requireUser } from '@/server/auth/guards'
import { searchProductVariants } from '@/server/queries/products'

export async function GET(request: Request) {
  await requireUser()
  const q = new URL(request.url).searchParams.get('q') ?? ''
  const results = await searchProductVariants(q)
  return NextResponse.json({ results })
}
```

- [ ] **Step 4: Implementar `src/app/api/health/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { prisma } from '@/server/db'

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 })
  }
}
```

- [ ] **Step 5: Ejecutar — debe pasar.** Run: `pnpm test src/app/api/search/route.test.ts` → PASS.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: route handlers /api/search (autocompletar) y /api/health"
```

---

### Task 21: `FastEntryGrid` — grilla con navegación por teclado y validación por fila

**Files:**
- Create: `src/components/grid/types.ts`
- Create: `src/components/grid/useGridKeyboardNav.ts`
- Create: `src/components/grid/VariantSearchCell.tsx`
- Create: `src/components/grid/FastEntryGrid.tsx`
- Test: `src/components/grid/FastEntryGrid.test.tsx`

**Interfaces:**
- Consumes: `VariantOption` (Task 12) vía `fetch('/api/search?q=')`
- Produces:
  - `type GridRow = { key: string; variant: VariantOption | null; counted: string; error?: string }`
  - `validateRow(row: GridRow, allRows: GridRow[]): string | undefined` — `'Seleccioná un producto/variante'` si `variant` null; `'Cantidad inválida'` si `counted` no es entero ≥ 0; `'Ya está en la fila N'` si `variant.variantId` duplicado en una fila anterior
  - `<FastEntryGrid onSubmit={(payload: { variantId: string; counted: number }[]) => Promise<BatchResult>} />` — maneja filas, alta por búsqueda, navegación por teclado (Enter=nueva fila / Tab / ↑↓ en Cantidad / Esc=borrar fila), marca filas con error y muestra el resumen "N guardadas, M con error" del `BatchResult`

- [ ] **Step 1: Test que falla — `src/components/grid/FastEntryGrid.test.tsx`**

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FastEntryGrid, validateRow } from './FastEntryGrid'

const FastEntryGridHarness = () => <FastEntryGrid onSubmit={vi.fn().mockResolvedValue({ batchId: 'b', saved: 0, failed: 0, results: [] })} />

describe('validateRow', () => {
  const base = { key: 'r1', variant: { variantId: 'v1', productName: 'P', variantName: 'V', categoryName: 'C' }, counted: '5' }
  it('ok cuando hay variante y cantidad entera', () => {
    expect(validateRow(base, [base])).toBeUndefined()
  })
  it('exige seleccionar variante', () => {
    expect(validateRow({ ...base, variant: null }, [])).toBe('Seleccioná un producto/variante')
  })
  it('rechaza cantidad no entera o negativa', () => {
    expect(validateRow({ ...base, counted: '2.5' }, [base])).toBe('Cantidad inválida')
    expect(validateRow({ ...base, counted: '-1' }, [base])).toBe('Cantidad inválida')
    expect(validateRow({ ...base, counted: '' }, [base])).toBe('Cantidad inválida')
  })
  it('detecta variante duplicada en una fila anterior', () => {
    const r2 = { ...base, key: 'r2' }
    expect(validateRow(r2, [base, r2])).toBe('Ya está en la fila 1')
  })
})

describe('FastEntryGrid', () => {
  it('Enter en Cantidad agrega una fila nueva', async () => {
    render(<FastEntryGridHarness />)  // harness que renderiza <FastEntryGrid onSubmit={vi.fn()} />
    const inputs = () => screen.getAllByPlaceholderText('Buscar producto…')
    expect(inputs()).toHaveLength(1)
    await userEvent.type(screen.getByLabelText('Cantidad (fila 1)'), '3{Enter}')
    expect(inputs()).toHaveLength(2)
  })
  it('al guardar, llama onSubmit solo con filas válidas y muestra el resumen', async () => {
    const onSubmit = vi.fn().mockResolvedValue({ batchId: 'b', saved: 1, failed: 0, results: [] })
    render(<FastEntryGrid onSubmit={onSubmit} initialRows={[
      { key: 'r1', variant: { variantId: 'v1', productName: 'P', variantName: 'V', categoryName: 'C' }, counted: '4' },
      { key: 'r2', variant: null, counted: '' },
    ]} />)
    await userEvent.click(screen.getByRole('button', { name: /Guardar lote/ }))
    expect(onSubmit).toHaveBeenCalledWith([{ variantId: 'v1', counted: 4 }])
    expect(await screen.findByText('1 guardadas, 1 con error')).toBeInTheDocument()
  })
})
```

> Nota para el implementador: exportá `FastEntryGrid` con una prop opcional `initialRows` para poder testear sin pasar por la búsqueda. El `FastEntryGridHarness` es un wrapper trivial local al test.

- [ ] **Step 2: Ejecutar — debe fallar.** Run: `pnpm test src/components/grid/FastEntryGrid.test.tsx` → FAIL.

- [ ] **Step 3: Implementar `src/components/grid/types.ts`**

```ts
import type { VariantOption } from '@/server/queries/products'
export type { VariantOption }
export type GridRow = { key: string; variant: VariantOption | null; counted: string; error?: string }
```

- [ ] **Step 4: Implementar `src/components/grid/useGridKeyboardNav.ts`**

```ts
'use client'
import type { KeyboardEvent } from 'react'

function focusCell(row: number, col: 'search' | 'counted') {
  const el = document.querySelector<HTMLElement>(`[data-cell="${row}:${col}"]`)
  el?.focus()
  if (el instanceof HTMLInputElement) el.select()
}

export function useGridKeyboardNav(opts: { onAddRow: () => void; onDeleteRow: (i: number) => void }) {
  return function onKeyDown(e: KeyboardEvent, rowIndex: number, col: 'search' | 'counted') {
    if (col === 'counted' && e.key === 'Enter') {
      e.preventDefault()
      opts.onAddRow()
      // la fila nueva se agrega al final; enfocá su celda de búsqueda tras el re-render
      requestAnimationFrame(() => focusCell(rowIndex + 1, 'search'))
    } else if (col === 'counted' && e.key === 'ArrowUp') {
      e.preventDefault()
      focusCell(Math.max(0, rowIndex - 1), 'counted')
    } else if (col === 'counted' && e.key === 'ArrowDown') {
      e.preventDefault()
      focusCell(rowIndex + 1, 'counted')
    } else if (e.key === 'Escape') {
      e.preventDefault()
      opts.onDeleteRow(rowIndex)
    }
  }
}
```

- [ ] **Step 5: Implementar `src/components/grid/VariantSearchCell.tsx`**

```tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import type { VariantOption } from './types'

export function VariantSearchCell({
  rowIndex, value, onSelect, onKeyDown,
}: {
  rowIndex: number
  value: VariantOption | null
  onSelect: (o: VariantOption) => void
  onKeyDown: (e: React.KeyboardEvent, row: number, col: 'search') => void
}) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<VariantOption[]>([])
  const [open, setOpen] = useState(false)
  const abort = useRef<AbortController | null>(null)

  useEffect(() => {
    if (value) return
    const term = q.trim()
    if (term.length < 2) { setResults([]); return }
    const t = setTimeout(async () => {
      abort.current?.abort()
      abort.current = new AbortController()
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: abort.current.signal })
        const body = await res.json()
        setResults(body.results as VariantOption[])
        setOpen(true)
      } catch { /* abortada */ }
    }, 250)
    return () => clearTimeout(t)
  }, [q, value])

  if (value) {
    return (
      <button type="button" data-cell={`${rowIndex}:search`}
        className="text-left text-sm underline"
        onClick={() => { onSelect(null as unknown as VariantOption); setQ('') }}>
        {value.productName} — {value.variantName} <span className="text-muted">({value.categoryName})</span>
      </button>
    )
  }

  return (
    <div className="relative">
      <input data-cell={`${rowIndex}:search`} placeholder="Buscar producto…" value={q}
        onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => onKeyDown(e, rowIndex, 'search')}
        className="w-full border border-border rounded px-2 py-1 text-sm" />
      {open && results.length > 0 && (
        <ul className="absolute z-10 mt-1 w-72 max-h-56 overflow-auto bg-card border border-border rounded shadow">
          {results.map((o) => (
            <li key={o.variantId}>
              <button type="button" className="block w-full text-left px-2 py-1 text-sm hover:bg-border/40"
                onClick={() => { onSelect(o); setOpen(false); requestAnimationFrame(() => {
                  document.querySelector<HTMLElement>(`[data-cell="${rowIndex}:counted"]`)?.focus()
                }) }}>
                {o.productName} — {o.variantName} <span className="text-muted">({o.categoryName})</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Implementar `FastEntryGrid.tsx`** con `validateRow` exportada:

```tsx
'use client'
import { useMemo, useState } from 'react'
import type { BatchResult } from '@/server/actions/inventory'
import type { GridRow, VariantOption } from './types'

let seq = 0
const newRow = (): GridRow => ({ key: `row-${++seq}`, variant: null, counted: '' })

export function validateRow(row: GridRow, allRows: GridRow[]): string | undefined {
  if (!row.variant) return 'Seleccioná un producto/variante'
  const n = Number(row.counted)
  if (row.counted.trim() === '' || !Number.isInteger(n) || n < 0) return 'Cantidad inválida'
  const idx = allRows.findIndex((r) => r.variant?.variantId === row.variant!.variantId)
  const self = allRows.findIndex((r) => r.key === row.key)
  if (idx !== -1 && idx < self) return `Ya está en la fila ${idx + 1}`
  return undefined
}

export function FastEntryGrid({
  onSubmit, initialRows,
}: {
  onSubmit: (payload: { variantId: string; counted: number }[]) => Promise<BatchResult>
  initialRows?: GridRow[]
}) {
  const [rows, setRows] = useState<GridRow[]>(initialRows ?? [newRow()])
  const [summary, setSummary] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const validated = useMemo(
    () => rows.map((r) => ({ ...r, error: validateRow(r, rows) })),
    [rows],
  )

  const addRow = () => setRows((rs) => [...rs, newRow()])
  const deleteRow = (i: number) => setRows((rs) => (rs.length > 1 ? rs.filter((_, x) => x !== i) : rs))
  const setVariant = (i: number, v: VariantOption) =>
    setRows((rs) => rs.map((r, x) => (x === i ? { ...r, variant: v } : r)))
  const setCounted = (i: number, val: string) =>
    setRows((rs) => rs.map((r, x) => (x === i ? { ...r, counted: val } : r)))

  async function save() {
    const payload = validated.filter((r) => !r.error).map((r) => ({
      variantId: r.variant!.variantId, counted: Number(r.counted),
    }))
    if (payload.length === 0) { setSummary('No hay filas válidas para guardar'); return }
    setSaving(true)
    const res = await onSubmit(payload)
    setSaving(false)
    const failedLocal = validated.length - payload.length
    setSummary(`${res.saved} guardadas, ${res.failed + failedLocal} con error`)
    // Quitar de la grilla las filas guardadas OK
    const savedIds = new Set(res.results.filter((r) => r.ok).map((r) => r.variantId))
    setRows((rs) => {
      const kept = rs.filter((r) => !(r.variant && savedIds.has(r.variant.variantId)))
      return kept.length ? kept : [newRow()]
    })
  }

  const onKeyDown = useGridKeyboardNav({ onAddRow: addRow, onDeleteRow: deleteRow })

  return (
    <div>
      <table className="w-full text-sm border border-border rounded">
        <thead className="bg-card">
          <tr>
            <th className="text-left p-2 w-2/3">Producto / Variante</th>
            <th className="text-right p-2">Cantidad contada</th>
            <th className="p-2 w-8"></th>
          </tr>
        </thead>
        <tbody>
          {validated.map((row, i) => (
            <tr key={row.key} className={row.error ? 'bg-danger/10' : undefined}>
              <td className="p-2 align-top">
                <VariantSearchCell rowIndex={i} value={row.variant}
                  onSelect={(o) => setVariant(i, o)} onKeyDown={onKeyDown} />
                {row.error && <p className="text-xs text-danger mt-1">{row.error}</p>}
              </td>
              <td className="p-2 text-right align-top">
                <input data-cell={`${i}:counted`} aria-label={`Cantidad (fila ${i + 1})`}
                  inputMode="numeric" value={row.counted}
                  onChange={(e) => setCounted(i, e.target.value)}
                  onKeyDown={(e) => onKeyDown(e, i, 'counted')}
                  className="w-24 border border-border rounded px-2 py-1 text-right" />
              </td>
              <td className="p-2 text-center align-top">
                <button type="button" aria-label={`Eliminar fila ${i + 1}`} onClick={() => deleteRow(i)}
                  className="text-muted hover:text-danger">×</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex items-center gap-3">
        <button type="button" onClick={addRow} className="text-sm underline">+ Agregar fila</button>
        <button type="button" onClick={save} disabled={saving}
          className="bg-primary text-primary-foreground rounded px-3 py-2 text-sm disabled:opacity-60">
          {saving ? 'Guardando…' : 'Guardar lote'}
        </button>
        {summary && <p className="text-sm">{summary}</p>}
      </div>
    </div>
  )
}
```

Agregar a los imports de `FastEntryGrid.tsx`:

```tsx
import { useGridKeyboardNav } from './useGridKeyboardNav'
import { VariantSearchCell } from './VariantSearchCell'
```

- [ ] **Step 7: Ejecutar — debe pasar.** Run: `pnpm test src/components/grid/FastEntryGrid.test.tsx` → PASS.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: FastEntryGrid (navegación por teclado, validación por fila, resumen de lote)"
```

---

### Task 22: Página `/carga-inicial`

**Files:**
- Create: `src/app/(app)/carga-inicial/page.tsx`
- Create: `src/app/(app)/carga-inicial/CargaInicialClient.tsx`

**Interfaces:**
- Consumes: `FastEntryGrid` (Task 21), `saveInitialStockBatch` (Task 18)
- Produces: página que renderiza el grid y le pasa `onSubmit`

- [ ] **Step 1: `CargaInicialClient.tsx`**

```tsx
'use client'
import { FastEntryGrid } from '@/components/grid/FastEntryGrid'
import { saveInitialStockBatch } from '@/server/actions/inventory'

export function CargaInicialClient() {
  return <FastEntryGrid onSubmit={(payload) => saveInitialStockBatch(payload)} />
}
```

- [ ] **Step 2: `src/app/(app)/carga-inicial/page.tsx`**

```tsx
import { CargaInicialClient } from './CargaInicialClient'

export default function CargaInicialPage() {
  return (
    <section>
      <h1 className="text-xl font-semibold mb-1">Carga inicial de stock</h1>
      <p className="text-sm text-muted mb-4">
        Buscá el producto y la variante, ingresá la cantidad contada y guardá el lote.
        La cantidad ingresada reemplaza el stock actual (ajuste absoluto).
      </p>
      <CargaInicialClient />
    </section>
  )
}
```

- [ ] **Step 3: Verificación manual (flujo completo).**
  1. Crear un producto con 2 variantes en `/productos/nuevo`.
  2. En `/carga-inicial`, buscar el producto, agregar ambas variantes, cargar cantidades con Enter entre filas.
  3. Dejar una fila sin cantidad → al guardar se marca en rojo y el resumen dice "1 guardadas, 1 con error".
  4. Ir a `/deposito` → las cantidades guardadas aparecen.
  5. Volver a `/carga-inicial`, recontar una variante con otro número → `/deposito` refleja el último valor; en Studio hay 2 `InventoryTransaction` `CARGA_INICIAL` con distinto `batchId`.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: página /carga-inicial conectada a saveInitialStockBatch"
```

---

## Phase 7 — Vista de depósito

### Task 23: Página `/deposito` (stock en tiempo real, filtros, ajuste manual, orden)

**Files:**
- Create: `src/app/(app)/deposito/page.tsx`
- Create: `src/components/deposito/StockFilters.tsx` (Client)
- Create: `src/components/deposito/AdjustStockDialog.tsx` (Client)
- Create: `src/components/deposito/StockTableHeader.tsx` (Client — orden por columna, **P1**)
- Test: `src/components/deposito/StockFilters.test.tsx`
- Test: `src/components/deposito/AdjustStockDialog.test.tsx`

**Interfaces:**
- Consumes: `listStock` (Task 17), `listCategoryOptions` (Task 9), `adjustStock` (Task 19), `money`, `integer`, `useToast`
- Produces:
  - `<StockFilters categories={{value,label}[]} />` — `q` (debounce 300 ms), select de categoría, select de estado (`todos` | `disponible` | `sin_stock`); escribe todo en `searchParams` vía `router.push`
  - `<AdjustStockDialog variantId label currentQuantity />` — abre `Dialog` con `Input` cantidad + `Input` motivo (requerido); llama `adjustStock({ variantId, quantity, note })`; en `ok:false` muestra el error en el dialog; en `ok:true` cierra y `toast('Stock ajustado', 'success')`
  - `<StockTableHeader sort dir />` (**P1**) — encabezados clicables que alternan `sort`/`dir` en `searchParams`

- [ ] **Step 1: Test que falla — `src/components/deposito/StockFilters.test.tsx`**

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/deposito',
  useSearchParams: () => new URLSearchParams(''),
}))
import { StockFilters } from './StockFilters'

describe('StockFilters', () => {
  it('empuja status al elegir "Sin stock"', async () => {
    render(<StockFilters categories={[]} />)
    await userEvent.selectOptions(screen.getByLabelText('Estado'), 'sin_stock')
    expect(push).toHaveBeenCalledWith(expect.stringContaining('status=sin_stock'))
  })
})
```

- [ ] **Step 2: Test que falla — `src/components/deposito/AdjustStockDialog.test.tsx`**

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const adjustStock = vi.fn()
vi.mock('@/server/actions/inventory', () => ({ adjustStock }))
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
import { AdjustStockDialog } from './AdjustStockDialog'

describe('AdjustStockDialog', () => {
  it('exige motivo: muestra el error de la action', async () => {
    adjustStock.mockResolvedValue({ ok: false, error: 'El motivo es obligatorio' })
    render(<AdjustStockDialog variantId="v1" label="P · V" currentQuantity={5} />)
    await userEvent.click(screen.getByRole('button', { name: 'Ajustar' }))
    await userEvent.clear(screen.getByLabelText('Nueva cantidad'))
    await userEvent.type(screen.getByLabelText('Nueva cantidad'), '3')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar ajuste' }))
    expect(adjustStock).toHaveBeenCalledWith({ variantId: 'v1', quantity: 3, note: '' })
    expect(await screen.findByText('El motivo es obligatorio')).toBeInTheDocument()
  })
  it('con datos válidos llama adjustStock con el motivo', async () => {
    adjustStock.mockResolvedValue({ ok: true, delta: -2, quantityAfter: 3 })
    render(<AdjustStockDialog variantId="v1" label="P · V" currentQuantity={5} />)
    await userEvent.click(screen.getByRole('button', { name: 'Ajustar' }))
    await userEvent.clear(screen.getByLabelText('Nueva cantidad'))
    await userEvent.type(screen.getByLabelText('Nueva cantidad'), '3')
    await userEvent.type(screen.getByLabelText('Motivo'), 'Rotura')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar ajuste' }))
    expect(adjustStock).toHaveBeenCalledWith({ variantId: 'v1', quantity: 3, note: 'Rotura' })
  })
})
```

- [ ] **Step 3: Ejecutar — deben fallar.** Run: `pnpm test src/components/deposito/` → FAIL.

- [ ] **Step 4: Implementar `StockFilters.tsx`** — igual patrón que `ProductFilters` (Task 15) más el `<select>` de Estado con `aria-label="Estado"` y opciones `Todos` / `Disponible` / `Sin stock`.

- [ ] **Step 5: Implementar `AdjustStockDialog.tsx`** — botón "Ajustar" abre `Dialog`; estado local `quantity` (init `currentQuantity`) y `note`; "Guardar ajuste" llama `adjustStock({ variantId, quantity: Number(quantity), note })`; `ok:false` → set `error`; `ok:true` → cerrar + `toast`.

- [ ] **Step 6: Implementar `StockTableHeader.tsx` (P1)** — recibe `sort`/`dir` de props; cada `<th>` clicable hace `router.push` alternando `dir` (`asc`↔`desc`) o fijando el nuevo `sort` con `dir=asc`.

- [ ] **Step 7: Ejecutar — deben pasar.** Run: `pnpm test src/components/deposito/` → PASS.

- [ ] **Step 8: Implementar `src/app/(app)/deposito/page.tsx`**

```tsx
import { listStock } from '@/server/queries/inventory'
import { listCategoryOptions } from '@/server/queries/categories'
import { StockFilters } from '@/components/deposito/StockFilters'
import { AdjustStockDialog } from '@/components/deposito/AdjustStockDialog'
import { money, integer } from '@/lib/format'

type SP = { q?: string; categoryId?: string; status?: 'todos' | 'disponible' | 'sin_stock'
  sort?: 'producto' | 'stock' | 'precio'; dir?: 'asc' | 'desc' }

export default async function DepositoPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const [{ rows, totalVariants, totalUnits }, categories] = await Promise.all([
    listStock(sp),
    listCategoryOptions(),
  ])
  return (
    <section>
      <h1 className="text-xl font-semibold mb-4">Depósito</h1>
      <StockFilters categories={categories} />
      <table className="w-full mt-4 text-sm border border-border rounded">
        <thead className="bg-card">
          <tr>
            <th className="text-left p-2">Producto</th><th className="text-left p-2">Variante</th>
            <th className="text-left p-2">Categoría</th><th className="text-right p-2">Stock</th>
            <th className="text-right p-2">Costo unit.</th><th className="text-right p-2">Precio venta</th>
            <th className="p-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.variantId} className="border-t border-border">
              <td className="p-2">{r.productName}</td>
              <td className="p-2">{r.variantName}</td>
              <td className="p-2">{r.categoryName}</td>
              <td className="p-2 text-right">{integer(r.quantity)}</td>
              <td className="p-2 text-right">{money(r.unitCost)}</td>
              <td className="p-2 text-right">{money(r.unitPrice)}</td>
              <td className="p-2 text-right">
                <AdjustStockDialog variantId={r.variantId}
                  label={`${r.productName} · ${r.variantName}`} currentQuantity={r.quantity} />
              </td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={7} className="p-4 text-center text-muted">Sin resultados</td></tr>}
        </tbody>
        <tfoot>
          <tr className="border-t border-border font-medium">
            <td className="p-2" colSpan={3}>{totalVariants} variantes</td>
            <td className="p-2 text-right">{integer(totalUnits)}</td>
            <td colSpan={3}></td>
          </tr>
        </tfoot>
      </table>
    </section>
  )
}
```

- [ ] **Step 9: Verificación manual.**
  - `/deposito` muestra todas las variantes activas; las sin `InventoryStock` en 0.
  - Filtro de categoría + estado + búsqueda funcionan y persisten en la URL al recargar.
  - Pie muestra conteo de variantes y suma de unidades.
  - "Ajustar" sin motivo → error; con motivo → stock cambia y aparece un `InventoryTransaction` `AJUSTE` en Studio.
  - (P1) Click en encabezado ordena asc/desc.

- [ ] **Step 10: Commit**

```bash
git add -A && git commit -m "feat: vista /deposito (stock en tiempo real, filtros, ajuste manual, orden)"
```

---

## Phase 8 — ABM de usuarios (P1)

### Task 24: Usuarios (solo ADMIN)

**Files:**
- Create: `src/server/validation/user.ts`
- Create: `src/server/queries/users.ts`
- Create: `src/server/actions/users.ts`
- Create: `src/app/(app)/usuarios/page.tsx`
- Create: `src/components/forms/UserManager.tsx` (Client)
- Test: `src/server/actions/users.test.ts`

**Interfaces:**
- Consumes: `prisma`, `requireRole('ADMIN')`, `hashPassword` (Task 3), `revalidatePath`
- Produces:
  - `type ActionResult = { ok: true } | { ok: false; error: string }` — definir localmente en `users.ts`, idéntico al de `categories.ts` (Task 9)
  - `userCreateSchema` (zod): `{ email: string.email, name: string.trim().min(2), role: z.enum(['ADMIN','DEPOSITO']), password: string.min(8, 'Mínimo 8 caracteres') }`
  - `userUpdateSchema` (zod): `{ name, role, password: string.min(8).optional().or(literal('')) }`
  - `listUsers(): Promise<Array<{ id, email, name, role, active, createdAt }>>` (orden `createdAt asc`)
  - `createUser(input): Promise<ActionResult>` — `P2002` → `'Ya existe un usuario con ese email'`
  - `updateUser(id, input): Promise<ActionResult>` — si `password` no vacío, re-hashea
  - `setUserActive(id, active: boolean): Promise<ActionResult>` — no permite desactivarse a uno mismo (`'No podés desactivar tu propio usuario'`)

- [ ] **Step 1: Test que falla — `src/server/actions/users.test.ts`**

```ts
import { describe, expect, it, beforeEach, vi } from 'vitest'
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
const requireRole = vi.fn().mockResolvedValue({ sub: 'ADMIN_ID', role: 'ADMIN', name: 'Admin' })
vi.mock('@/server/auth/guards', () => ({ requireRole, requireUser: vi.fn() }))
import { prisma, resetDb } from '@/test/db'
import { hashPassword } from '@/server/auth/password'
import { createUser, setUserActive } from './users'
import { listUsers } from '@/server/queries/users'

let adminId: string
beforeEach(async () => {
  await resetDb()
  adminId = (await prisma.user.create({
    data: { email: 'admin@a.com', name: 'Admin', role: 'ADMIN', passwordHash: await hashPassword('x') },
  })).id
  requireRole.mockResolvedValue({ sub: adminId, role: 'ADMIN', name: 'Admin' })
})

describe('createUser', () => {
  it('crea un usuario activo que puede autenticarse (hash != plano)', async () => {
    expect(await createUser({ email: 'dep@a.com', name: 'Depo', role: 'DEPOSITO', password: 'secreto12' }))
      .toEqual({ ok: true })
    const u = await prisma.user.findUniqueOrThrow({ where: { email: 'dep@a.com' } })
    expect(u.active).toBe(true)
    expect(u.passwordHash).not.toBe('secreto12')
  })
  it('rechaza email duplicado', async () => {
    expect(await createUser({ email: 'admin@a.com', name: 'X', role: 'ADMIN', password: 'secreto12' }))
      .toEqual({ ok: false, error: 'Ya existe un usuario con ese email' })
  })
  it('rechaza contraseña corta', async () => {
    expect(await createUser({ email: 'x@a.com', name: 'X', role: 'ADMIN', password: 'corta' }))
      .toEqual({ ok: false, error: 'Mínimo 8 caracteres' })
  })
})

describe('setUserActive', () => {
  it('no permite auto-desactivarse', async () => {
    expect(await setUserActive(adminId, false)).toEqual({ ok: false, error: 'No podés desactivar tu propio usuario' })
  })
  it('desactiva a otro usuario', async () => {
    const other = await prisma.user.create({ data: { email: 'o@a.com', name: 'O', passwordHash: 'x' } })
    expect(await setUserActive(other.id, false)).toEqual({ ok: true })
    expect((await listUsers()).find((u) => u.id === other.id)?.active).toBe(false)
  })
})
```

- [ ] **Step 2: Ejecutar — debe fallar.** Run: `pnpm test src/server/actions/users.test.ts` → FAIL.

- [ ] **Step 3: Implementar** `validation/user.ts`, `queries/users.ts`, `actions/users.ts` según las interfaces. `createUser`/`updateUser`/`setUserActive` empiezan con `const session = await requireRole('ADMIN')`. En `setUserActive`, comparar `id === session.sub` antes de desactivar. Mensajes de zod exactamente `'Mínimo 8 caracteres'` para el `min(8)` de password.

- [ ] **Step 4: Ejecutar — debe pasar.** Run: `pnpm test src/server/actions/users.test.ts` → PASS.

- [ ] **Step 5: Implementar `UserManager.tsx`** — alta (email, nombre, rol, contraseña) + tabla con rol/estado y botones "Editar" (Dialog) y "Activar/Desactivar". Mostrar `error` de las actions con `toast`.

- [ ] **Step 6: Implementar `src/app/(app)/usuarios/page.tsx`**

```tsx
import { requireRole } from '@/server/auth/guards'
import { listUsers } from '@/server/queries/users'
import { UserManager } from '@/components/forms/UserManager'

export default async function UsuariosPage() {
  await requireRole('ADMIN')
  const users = await listUsers()
  return (
    <section className="max-w-3xl">
      <h1 className="text-xl font-semibold mb-4">Usuarios</h1>
      <UserManager users={users} />
    </section>
  )
}
```

- [ ] **Step 7: Verificación manual.** Como ADMIN: crear un usuario DEPOSITO, iniciar sesión con él en otra ventana, verificar que NO ve "Usuarios" y que `/usuarios` lo redirige a `/deposito`. Desactivarlo → no puede volver a entrar.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: ABM de usuarios (solo ADMIN, roles, activar/desactivar)"
```

---

## Phase 9 — Deploy

### Task 25: Preparación de producción y despliegue en Vercel + Neon

**Files:**
- Modify: `package.json` (`postinstall`)
- Modify: `next.config.ts` (si hace falta `serverExternalPackages`)
- Create: `README.md` (sección "Despliegue") — reemplazar el README de CNA
- Create: `docs/deploy.md`

**Interfaces:** ninguna nueva. Es configuración + verificación.

- [ ] **Step 1: `postinstall` para generar el cliente Prisma en el build**

```json
{ "scripts": { "postinstall": "prisma generate" } }
```

- [ ] **Step 2: Revisar `next.config.ts`** — si `pnpm build` se queja de `bcryptjs`/`@prisma/client` en el bundle del servidor, agregar:

```ts
const nextConfig: NextConfig = { serverExternalPackages: ['@prisma/client', 'bcryptjs'] }
```

- [ ] **Step 3: `docs/deploy.md`** con el procedimiento exacto:
  1. **Neon**: crear proyecto → copiar *pooled* connection string (`...-pooler...`) a `DATABASE_URL` y la *direct* a `DIRECT_URL`.
  2. **Vercel**: New Project → importar el repo → Framework preset "Next.js" (build/output por defecto).
  3. **Env vars en Vercel** (Production + Preview): `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET` (`openssl rand -base64 32`), `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`.
  4. **Migraciones** (una vez, desde la máquina del dev con las env de producción cargadas): `pnpm dlx prisma migrate deploy` y luego `pnpm dlx prisma db seed`.
  5. **Deploy**: push a `main` → Vercel construye. Verificar `GET /<app>/api/health` → `{ "ok": true }`.
  6. **Smoke test en producción**: login con el admin del seed → crear categoría → crear producto → cargar stock en `/carga-inicial` → verlo en `/deposito`.
  7. **Región**: confirmar que la Function Region de Vercel y la región de Neon coinciden (Settings → Functions).

- [ ] **Step 4: Reescribir `README.md`** — nombre del proyecto, stack, cómo correr local (`.env`, `pnpm i`, `pnpm db:migrate`, `pnpm db:seed`, `pnpm dev`), cómo correr tests (`pnpm test`, requiere `DATABASE_URL` a una base de test), y link a `docs/deploy.md`.

- [ ] **Step 5: Verificación local del build de producción**

Run: `pnpm build && pnpm start` → la app arranca; `/login` funciona; `/api/health` responde `{ ok: true }`.

- [ ] **Step 6: Ejecutar la suite completa**

Run: `pnpm test` → todo verde. `pnpm lint` → sin errores.

- [ ] **Step 7: Commit y push**

```bash
git add -A && git commit -m "chore: preparación de producción (postinstall prisma, docs de deploy, README)"
git push origin master
```

- [ ] **Step 8: Deploy real** siguiendo `docs/deploy.md` y completar el smoke test del paso 3.6.

---

## Phase 10 — Mejora P2 (opcional)

### Task 26: Pegar cantidades desde Excel en la grilla

**Files:**
- Modify: `src/components/grid/FastEntryGrid.tsx`
- Test: `src/components/grid/FastEntryGrid.test.tsx` (nuevo caso)

**Interfaces:** sin cambios de firma. Añade un handler `onPaste` en la celda Cantidad.

- [ ] **Step 1: Test que falla**

```tsx
it('pegar varias líneas en Cantidad completa filas consecutivas', async () => {
  render(<FastEntryGrid onSubmit={vi.fn()} initialRows={[
    { key: 'r1', variant: { variantId: 'v1', productName: 'P', variantName: 'A', categoryName: 'C' }, counted: '' },
    { key: 'r2', variant: { variantId: 'v2', productName: 'P', variantName: 'B', categoryName: 'C' }, counted: '' },
  ]} />)
  const first = screen.getByLabelText('Cantidad (fila 1)')
  first.focus()
  await userEvent.paste('3\n7')
  expect(screen.getByLabelText('Cantidad (fila 1)')).toHaveValue('3')
  expect(screen.getByLabelText('Cantidad (fila 2)')).toHaveValue('7')
})
```

- [ ] **Step 2: Ejecutar — debe fallar.** Run: `pnpm test src/components/grid/FastEntryGrid.test.tsx -t pegar` → FAIL.

- [ ] **Step 3: Implementar `onPaste`** en la celda Cantidad: `e.preventDefault()`, `text.split(/\r?\n/)`, escribir cada valor en `counted` de las filas desde la actual; si faltan filas, `addRow()` por cada línea sobrante.

- [ ] **Step 4: Ejecutar — debe pasar.** Run: `pnpm test src/components/grid/FastEntryGrid.test.tsx` → PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: pegar cantidades desde Excel en la grilla de carga (P2)"
```

---

## Cobertura del spec → tareas

| Spec | Tarea(s) |
|---|---|
| §3.1 Stack / tooling | 1 |
| §3.2 Estructura de carpetas | se materializa a lo largo de todas |
| §3.4 Auth (sesión, proxy, guards, seed) | 2, 3, 4, 5, 6 |
| §3.5 Manejo de errores (validación, error por fila, CHECK, `not-found`) | 2 (CHECK), 6/9/13/14 (validación), 16 (`not-found`), 18 (error por fila) |
| §3.6 Testing | cada tarea (TDD) + `src/test/db.ts` en 6 |
| §4 Schema (6 modelos, enums, relaciones, índices) | 2 |
| §4.2.1 Autocreación variante "Única" | 13 |
| §4.2.2 Costo/precio efectivo | 11, 12, 17 |
| §4.2.3 Autogeneración de `name` de variante | 11, 13, 14 |
| §4.2.4 CARGA_INICIAL ajuste absoluto | 18 |
| §4.2.5 AJUSTE | 19, 23 |
| §4.2.6 Borrado soft | 9, 13, 14, 24 |
| §4.2.7 Reconciliación | 17 |
| A1–A2 Login/Logout | 6 |
| A3 Seed admin | 2 |
| A4 ABM usuarios | 24 |
| B1–B4 Categorías | 9, 10 |
| C1 Crear producto + variantes | 13, 16 |
| C2 Listar/buscar productos | 12, 15 |
| C3 Editar producto / ABM variantes | 14, 16 |
| C4 Archivar producto | 13, 16 |
| D1 Agregar filas por búsqueda | 20, 21 |
| D2 Navegación por teclado | 21 |
| D3 Validación por fila | 21 |
| D4 Guardado por lote transaccional | 18, 22 |
| D5 Reanudar carga / recontar | 18 (test), 22 (verificación) |
| D6 Pegar desde Excel (P2) | 26 |
| E1 Consultar stock | 17, 23 |
| E2 Filtrar y buscar | 23 |
| E3 Ordenar (P1) | 23 |
| F1 Ajuste manual con motivo | 19, 23 |
| §6 Despliegue | 25 |

