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
