'use client'
import { useActionState } from 'react'
import { signIn } from '@/server/actions/auth'

export default function LoginPage() {
  const [state, action, pending] = useActionState(signIn, undefined)
  return (
    <form action={action} className="w-full max-w-sm bg-card border border-border rounded-lg p-6 space-y-4">
      <h1 className="text-lg font-semibold">Ingresar</h1>
      <label className="block text-sm">Email
        <input name="email" type="email" required autoFocus
          className="mt-1 w-full border border-border rounded px-3 py-2" />
      </label>
      <label className="block text-sm">Contraseña
        <input name="password" type="password" required
          className="mt-1 w-full border border-border rounded px-3 py-2" />
      </label>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <button type="submit" disabled={pending}
        className="w-full bg-primary text-primary-foreground rounded py-2 disabled:opacity-60">
        {pending ? 'Ingresando…' : 'Ingresar'}
      </button>
    </form>
  )
}
