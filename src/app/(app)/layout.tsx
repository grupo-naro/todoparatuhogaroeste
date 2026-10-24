import { requireUser } from '@/server/auth/guards'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { ToastProvider } from '@/components/ui/toast'
import { countReadyReservations } from '@/server/queries/reservations'

export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const session = await requireUser()
  // Reservas listas para avisar: el número aparece junto a "Reservas" en el menú.
  const ready = session.role === 'DEPOSITO' ? 0 : await countReadyReservations(session.role === 'VENDEDOR' ? session.sub : undefined)
  const badges = { '/reservas': ready }
  return (
    <div className="min-h-full flex flex-col">
      <Header userName={session.name} role={session.role} badges={badges} />
      <div className="flex flex-1">
        <Sidebar role={session.role} badges={badges} />
        <main className="flex-1 p-4 sm:p-6 min-w-0 print:p-0">
          <ToastProvider>{children}</ToastProvider>
        </main>
      </div>
    </div>
  )
}
