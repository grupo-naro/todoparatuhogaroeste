'use server'

import { redirect } from 'next/navigation'
import { prisma } from '@/server/db'
import { verifyPassword, hashPassword } from '@/server/auth/password'
import { createSession, destroySession } from '@/server/auth/session'
import { requireUser } from '@/server/auth/guards'
import { loginSchema, changePasswordSchema } from '@/server/validation/auth'

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

  await createSession({ sub: user.id, role: user.role, name: user.name, mustChangePassword: user.mustChangePassword })
  redirect('/productos')
}

export async function signOut(): Promise<void> {
  await destroySession()
  redirect('/login')
}

export async function changePassword(_prev: unknown, formData: FormData): Promise<{ error: string }> {
  const session = await requireUser()
  const parsed = changePasswordSchema.safeParse({
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const passwordHash = await hashPassword(parsed.data.password)
  await prisma.user.update({ where: { id: session.sub }, data: { passwordHash, mustChangePassword: false } })
  await createSession({ sub: session.sub, role: session.role, name: session.name, mustChangePassword: false })
  redirect('/productos')
}
