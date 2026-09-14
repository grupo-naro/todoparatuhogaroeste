'use client'
import { useActionState } from 'react'
import Image from 'next/image'
import { signIn } from '@/server/actions/auth'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function LoginPage() {
  const [state, action, pending] = useActionState(signIn, undefined)
  return (
    <form action={action} className="w-full max-w-sm bg-card border border-border rounded-lg p-6 space-y-4">
      <Image src="/logo.png" alt="Jael Castillo — Todo para tu Hogar" width={88} height={88} className="mx-auto rounded-full" priority />
      <h1 className="text-lg font-semibold text-center">Ingresar</h1>
      <label className="block text-sm">Email
        <Input name="email" type="email" required autoFocus className="mt-1" />
      </label>
      <label className="block text-sm">Contraseña
        <Input name="password" type="password" required className="mt-1" />
      </label>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Ingresando…' : 'Ingresar'}
      </Button>
    </form>
  )
}
