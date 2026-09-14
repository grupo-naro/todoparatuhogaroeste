'use client'
import { useActionState, useEffect, useRef } from 'react'
import { createUser, resetUserPassword } from '@/server/actions/users'
import { ROLES } from '@/lib/constants'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'

type UserRow = {
  id: string
  name: string
  email: string
  phone: string | null
  role: 'ADMIN' | 'DEPOSITO'
  active: boolean
  hasDni: boolean
}

export function UserManager({ users }: { users: UserRow[] }) {
  const { toast } = useToast()
  const formRef = useRef<HTMLFormElement>(null)
  const [altaState, altaAction] = useActionState(createUser, undefined)

  useEffect(() => {
    if (!altaState) return
    if (altaState.ok) formRef.current?.reset()
    else toast(altaState.error, 'danger')
  }, [altaState, toast])

  async function handleReset(id: string) {
    const res = await resetUserPassword(id)
    if (res.ok) toast('Contraseña reseteada al DNI', 'success')
    else toast(res.error, 'danger')
  }

  return (
    <div className="flex flex-col gap-6">
      <form ref={formRef} action={altaAction} className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm">Nombre</span>
          <Input name="name" required aria-label="Nombre" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm">Email</span>
          <Input name="email" type="email" required aria-label="Email" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm">Teléfono</span>
          <Input name="phone" aria-label="Teléfono" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm">Rol</span>
          <select
            name="role"
            required
            defaultValue=""
            aria-label="Rol"
            className="w-full border border-border rounded px-3 min-h-11 text-base md:text-sm bg-transparent"
          >
            <option value="" disabled>Elegí un rol</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-sm">DNI</span>
          <Input name="dni" required aria-label="DNI" inputMode="numeric" />
        </label>
        <div className="md:col-span-2">
          <Button type="submit" className="w-full md:w-auto">Crear usuario</Button>
        </div>
      </form>

      <ul className="flex flex-col divide-y divide-border">
        {users.map((u) => (
          <li key={u.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col">
              <span className="font-medium">{u.name}</span>
              <span className="text-sm text-muted">
                <span>{u.email}</span>
                {u.phone && <span> · {u.phone}</span>}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted">{u.role}</span>
              <span className={`text-sm ${u.active ? 'text-success' : 'text-danger'}`}>
                {u.active ? 'Activo' : 'Inactivo'}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={!u.hasDni}
                onClick={() => handleReset(u.id)}
              >
                Resetear contraseña ({u.name})
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
