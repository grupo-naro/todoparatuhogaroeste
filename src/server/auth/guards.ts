import 'server-only'
import { redirect } from 'next/navigation'
import type { RoleName } from '@/lib/constants'
import { readSession, type SessionPayload } from './session'

export async function requireUser(): Promise<SessionPayload> {
  const session = await readSession()
  if (!session) redirect('/login')
  if (session.mustChangePassword) redirect('/cambiar-contrasena')
  return session
}

export async function requireRole(role: RoleName | RoleName[]): Promise<SessionPayload> {
  const session = await requireUser()
  const allowed = Array.isArray(role) ? role : [role]
  if (!allowed.includes(session.role)) redirect(session.role === 'VENDEDOR' ? '/ventas' : '/productos')
  return session
}

// The only two places allowed to see a session that still needs a password
// change: the change-password action itself, and the page that renders its
// form. Every other guard in the app goes through `requireUser`, which now
// redirects such a session away — a Server Action is not covered by a
// layout's redirect (Next.js does not gate actions through layouts), so
// enforcing this in the shared guard, not just in `(app)/layout.tsx`, is
// what actually closes that gap.
export async function requireUserAllowingPasswordChange(): Promise<SessionPayload> {
  const session = await readSession()
  if (!session) redirect('/login')
  return session
}
