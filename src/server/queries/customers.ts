import 'server-only'
import { prisma } from '@/server/db'
import { toNumber } from '@/lib/pricing'
import { normalizePhone } from '@/lib/phone'

export async function getCustomerByPhone(rawPhone: string): Promise<{ id: string; name: string; phone: string } | null> {
  const phone = normalizePhone(rawPhone)
  if (phone.length < 6) return null
  return prisma.customer.findUnique({ where: { phone }, select: { id: true, name: true, phone: true } })
}

export type CustomerRow = {
  id: string; name: string; phone: string
  purchaseCount: number; totalSpent: number; isRecurring: boolean
}

export async function listCustomers(): Promise<CustomerRow[]> {
  const rows = await prisma.customer.findMany({
    include: { sales: { where: { cancelledAt: null }, select: { total: true } } },
    orderBy: { name: 'asc' },
  })
  return rows.map((c) => {
    const purchaseCount = c.sales.length
    const totalSpent = c.sales.reduce((sum, s) => sum + (toNumber(s.total) ?? 0), 0)
    return { id: c.id, name: c.name, phone: c.phone, purchaseCount, totalSpent, isRecurring: purchaseCount >= 2 }
  })
}
