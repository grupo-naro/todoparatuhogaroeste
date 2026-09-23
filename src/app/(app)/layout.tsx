import { requireUser } from '@/server/auth/guards'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { ToastProvider } from '@/components/ui/toast'

export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const session = await requireUser()
  return (
    <div className="min-h-full flex flex-col">
      <Header userName={session.name} role={session.role} />
      <div className="flex flex-1">
        <Sidebar role={session.role} />
        <main className="flex-1 p-4 sm:p-6 min-w-0 print:p-0">
          <ToastProvider>{children}</ToastProvider>
        </main>
      </div>
    </div>
  )
}
