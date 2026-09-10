'use server'

import { redirect } from 'next/navigation'
import { prisma } from '@/server/db'
import { verifyPassword } from '@/server/auth/password'
import { createSession, destroySession } from '@/server/auth/session'
import { loginSchema } from '@/server/validation/auth'

export async function signIn(_prev: unknown, formData: FormData): Promise<{ error: string }> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
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
