'use client'
import { useActionState } from 'react'
import Image from 'next/image'
import { changePassword } from '@/server/actions/auth'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePassword, undefined)
  return (
    <form action={action} className="w-full max-w-sm bg-card border border-border rounded-lg p-6 space-y-4">
      <Image src="/logo.png" alt="Jael Castillo — Todo para tu Hogar" width={88} height={88} className="mx-auto rounded-full" priority />
      <h1 className="text-lg font-semibold text-center">Cambiar contraseña</h1>
      <p className="text-sm text-muted text-center">
        Es tu primer ingreso — elegí una contraseña nueva para continuar.
      </p>
      <label className="block text-sm">Contraseña nueva
        <Input name="password" type="password" required autoFocus className="mt-1" />
      </label>
      <label className="block text-sm">Confirmar contraseña
        <Input name="confirmPassword" type="password" required className="mt-1" />
      </label>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Guardando…' : 'Guardar contraseña'}
      </Button>
    </form>
  )
}
