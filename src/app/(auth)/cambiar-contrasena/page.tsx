import { redirect } from 'next/navigation'
import { requireUserAllowingPasswordChange } from '@/server/auth/guards'
import { ChangePasswordForm } from './ChangePasswordForm'

export default async function CambiarContrasenaPage() {
  const session = await requireUserAllowingPasswordChange()
  if (!session.mustChangePassword) redirect('/productos')
  return <ChangePasswordForm />
}
