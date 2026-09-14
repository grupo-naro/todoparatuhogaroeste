import 'server-only'
import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'
import type { RoleName } from '@/lib/constants'

export const SESSION_COOKIE = 'session'
const MAX_AGE = 60 * 60 * 8 // 8h

export type SessionPayload = { sub: string; role: RoleName; name: string; mustChangePassword: boolean }

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET
  if (!s) throw new Error('AUTH_SECRET no configurado')
  return new TextEncoder().encode(s)
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ role: payload.role, name: payload.name, mustChangePassword: payload.mustChangePassword })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret())
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret())
    if (
      !payload.sub ||
      typeof payload.role !== 'string' ||
      typeof payload.name !== 'string' ||
      typeof payload.mustChangePassword !== 'boolean'
    ) return null
    return { sub: payload.sub, role: payload.role as RoleName, name: payload.name, mustChangePassword: payload.mustChangePassword }
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
