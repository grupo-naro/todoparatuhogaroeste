import { signOut } from '@/server/actions/auth'
import type { RoleName } from '@/lib/constants'
import { NavDrawer } from './NavDrawer'

export function Header({ userName, role }: { userName: string; role: RoleName }) {
  return (
    <header
      className="h-14 border-b border-border flex items-center gap-3 px-4 sticky top-0 bg-background z-20"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <NavDrawer role={role} />
      <span className="font-semibold">Gestión</span>
      <div className="ml-auto flex items-center gap-3 text-sm">
        <span className="text-muted hidden sm:inline">{userName}</span>
        <form action={signOut}>
          <button className="underline min-h-11 px-2">Salir</button>
        </form>
      </div>
    </header>
  )
}
