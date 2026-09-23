'use server'
import { requireRole } from '@/server/auth/guards'
import { getCustomerByPhone } from '@/server/queries/customers'

export async function findCustomerByPhoneAction(phone: string): Promise<{ id: string; name: string; phone: string } | null> {
  await requireRole(['ADMIN', 'VENDEDOR'])
  return getCustomerByPhone(phone)
}
