import { redirect } from 'next/navigation'
import { requireUser } from '@/server/auth/guards'
import { ChangePasswordForm } from './ChangePasswordForm'

export default async function CambiarContrasenaPage() {
  const session = await requireUser()
  if (!session.mustChangePassword) redirect('/productos')
  return <ChangePasswordForm />
}
