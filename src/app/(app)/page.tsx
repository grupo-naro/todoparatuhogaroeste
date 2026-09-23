import { redirect } from 'next/navigation'
import { requireUser } from '@/server/auth/guards'
import { getAdminDashboardStats, getVendedorDashboardStats } from '@/server/queries/dashboard'
import type { Period } from '@/lib/period'
import { AdminDashboard } from '@/components/dashboard/AdminDashboard'
import { VendedorDashboard } from '@/components/dashboard/VendedorDashboard'

export default async function IndexPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const session = await requireUser()
  if (session.role === 'DEPOSITO') redirect('/productos')

  const sp = await searchParams
  const period: Period = sp.period === 'week' || sp.period === 'month' ? sp.period : 'day'

  if (session.role === 'ADMIN') {
    const stats = await getAdminDashboardStats(period)
    return <AdminDashboard stats={stats} period={period} />
  }

  const stats = await getVendedorDashboardStats(session.sub, period)
  return <VendedorDashboard stats={stats} period={period} />
}
