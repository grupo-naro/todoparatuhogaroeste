# Sección Usuarios: alta con DNI y cambio de contraseña obligatorio

## Contexto y objetivo

Hoy no existe ninguna pantalla de gestión de usuarios. Los únicos usuarios
existen porque alguien los insertó a mano (el seed de admin). Se necesita:

1. Una pantalla `/usuarios` (solo ADMIN) para ver la lista de usuarios y dar
   de alta usuarios nuevos.
2. Un flujo de "primera contraseña" basado en el DNI: al crear un usuario se
   le pide nombre, email, teléfono, rol y DNI (no contraseña). La contraseña
   inicial es el DNI. Al iniciar sesión por primera vez, el sistema obliga a
   cambiarla antes de dejarlo usar el resto del panel.
3. Un mecanismo para que un ADMIN resetee la contraseña de alguien que se
   olvidó la suya: vuelve la clave al DNI y repite el flujo de cambio
   obligatorio.

Alcance de esta iteración: **listar y crear** usuarios, más el reset de
contraseña. Editar datos de un usuario existente o desactivarlo queda para
una iteración futura (el campo `active` ya existe en el modelo pero hoy nada
lo puede cambiar desde la UI; no se toca en este trabajo).

## Modelo de datos

`prisma/schema.prisma`, modelo `User` — agrega tres columnas:

```prisma
model User {
  id                 String   @id @default(uuid()) @db.Uuid
  email              String   @unique
  passwordHash       String
  name               String
  role               Role     @default(DEPOSITO)
  active             Boolean  @default(true)
  dni                String?  @unique
  phone              String?
  mustChangePassword Boolean  @default(false)
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
  transactions       InventoryTransaction[]
}
```

**`dni` es `String?` (opcional) a nivel de base**, aunque el formulario de
alta lo exige siempre. Motivo: ya hay usuarios reales en la base (el admin
sembrado) sin DNI cargado. Si la columna fuera `NOT NULL` la migración
rompería sobre datos existentes, y no hay un valor razonable para
"backfillear". Los usuarios existentes quedan con `dni = null` y
`mustChangePassword = false` (su contraseña actual sigue funcionando tal
cual); el flujo de DNI/cambio obligatorio aplica solo a usuarios creados de
acá en adelante. `@unique` sobre una columna nullable permite múltiples
`null` sin chocar entre sí (comportamiento estándar de Postgres).

Se necesita una migración nueva (`prisma migrate dev` en local generará el
SQL; aplicar con `prisma migrate deploy` en la base real y en la base de
test de Docker).

## Validación del DNI

Nuevo schema en `src/server/validation/user.ts`:

```ts
const dniField = z.string().trim().regex(/^\d{7,8}$/, 'DNI inválido (7 u 8 dígitos)')
```

Aplica solo en el alta (`createUserSchema`). El DNI no se vuelve a pedir ni
editar después de la creación en esta iteración.

## Sesión y el gate de "debe cambiar contraseña"

`SessionPayload` (`src/server/auth/session.ts`) suma un campo:

```ts
export type SessionPayload = { sub: string; role: RoleName; name: string; mustChangePassword: boolean }
```

Se firma dentro del JWT igual que `role`/`name` (no es secreto, solo estado
de UI). `signIn` (`src/server/actions/auth.ts`) lee `user.mustChangePassword`
de la fila recién autenticada y lo pasa a `createSession`.

**El gate vive en `src/app/(app)/layout.tsx`**, inmediatamente después de
`requireUser()`:

```ts
const session = await requireUser()
if (session.mustChangePassword) redirect('/cambiar-contrasena')
```

Esto bloquea *cualquier* página bajo `(app)` — Productos, Categorías, Usuarios
— hasta que la contraseña se cambie. La página `/cambiar-contrasena` vive
FUERA del grupo `(app)` (necesita ser alcanzable aunque el gate exista), en
un layout propio simple (reutiliza el patrón de `(auth)/layout.tsx`, con el
logo, pero requiere sesión — no es una pantalla pública).

`/cambiar-contrasena` vive fuera del grupo `(app)`, así que no pasa por su
gate — la propia página llama `requireUser()` al principio (redirige a
`/login` si no hay sesión) y luego:
- Si `!session.mustChangePassword`, redirige a `/productos` (nada que hacer
  ahí para un usuario que ya cambió su clave).
- Formulario: "Contraseña nueva" + "Confirmar contraseña". Mínimo 6
  caracteres, deben coincidir.
- Acción `changePassword` (`src/server/actions/auth.ts`): actualiza
  `passwordHash`, pone `mustChangePassword = false`, y **reemite la sesión**
  (`createSession` de nuevo con el JWT actualizado) para que el gate se
  libere sin pedir un segundo login. Redirige a `/productos`.

## Acciones del servidor — `src/server/actions/users.ts` (nuevo)

- `createUser(input)`: requiere rol ADMIN (`requireRole('ADMIN')`). Valida
  con `createUserSchema` (name, email, phone, role, dni). Genera
  `passwordHash = hashPassword(dni)`, `mustChangePassword: true`. Maneja
  P2002 distinguiendo email vs DNI duplicado (mismo patrón que ya existe en
  `products.ts`/`variants.ts` para desambiguar por índice).
- `resetUserPassword(id)`: requiere ADMIN. Si el usuario no tiene `dni`
  cargado (caso de los usuarios viejos sin DNI), devuelve un error claro en
  vez de resetear a `"null"` — algo como *"Este usuario no tiene DNI
  cargado, no se puede resetear la contraseña"*. Si tiene DNI: mismo hash +
  `mustChangePassword: true`.
- `listUsers()` en `src/server/queries/users.ts` (nuevo, sigue el patrón de
  `queries/products.ts`): devuelve id, name, email, phone, role, active, y
  `hasDni: boolean` (si `dni` no es null) — el DNI completo no se expone en
  la lista ni en ninguna query de lectura; solo se usa internamente al
  generar/resetear la contraseña. `hasDni` es lo que determina si el botón
  "Resetear contraseña" está habilitado para esa fila.

## Pantalla `/usuarios` (nueva)

- `src/app/(app)/usuarios/page.tsx`: server component, `requireRole('ADMIN')`,
  trae `listUsers()`, renderiza `UserList` + `UserForm` (client), siguiendo
  la estructura de `productos/page.tsx` + `ProductList`/`ProductForm`.
- Tabla: Nombre, Email, Teléfono, Rol, Activo/Inactivo, botón "Resetear
  contraseña" (con confirmación vía `useToast` del resultado, igual que
  `archiveVariant` en `ExistingVariantRow`).
- Formulario de alta: Nombre, Email, Teléfono (opcional), Rol (select
  ADMIN/DEPOSITO), DNI. Sin campo de contraseña.
- `navItems.ts` recupera la entrada `{ href: '/usuarios', label: 'Usuarios', icon: Users, adminOnly: true }`.

## Manejo de errores

| Caso | Mensaje |
|---|---|
| Email duplicado | "Ya existe un usuario con ese email" |
| DNI duplicado | "Ya existe un usuario con ese DNI" |
| DNI con formato inválido | "DNI inválido (7 u 8 dígitos)" (validación de campo, zod) |
| Reset sobre usuario sin DNI | "Este usuario no tiene DNI cargado, no se puede resetear la contraseña" |
| Nueva contraseña < 6 caracteres | "La contraseña debe tener al menos 6 caracteres" |
| Confirmación no coincide | "Las contraseñas no coinciden" |

## Testing

Sigue las convenciones ya establecidas en el repo (tests de acción contra la
base de Docker real vía `src/test/db.ts`, tests de componente con RTL):

- `src/server/actions/users.test.ts`: alta exitosa (passwordHash = hash del
  DNI, mustChangePassword true), rechazo de email/DNI duplicado, reset de
  contraseña (éxito y caso sin DNI).
- `src/server/actions/auth.test.ts`: `signIn` propaga `mustChangePassword`
  en la sesión creada; `changePassword` actualiza y reemite sesión.
- Componente: `UserForm`/`UserList` (envío de datos, aparición en la tabla) y
  la página `/cambiar-contrasena` (validación de mínimo/confirmación,
  redirect si no hace falta cambiarla).
- `src/app/(app)/layout.test.tsx` o similar, si el patrón del repo lo permite
  sin complicarse con Server Components async — si no, se cubre
  indirectamente vía un test de integración del signIn + primer acceso.

## Fuera de alcance (explícitamente, para esta iteración)

- Editar nombre/email/teléfono/rol de un usuario existente.
- Desactivar/reactivar usuarios desde la UI.
- Recuperación de contraseña por email (no hay envío de emails en el
  proyecto).
- Mostrar o exportar el DNI completo en la lista más allá de lo necesario
  para administrar (sin requisitos de enmascarado explícitos del cliente;
  se decide en implementación, no es una decisión de arquitectura).
