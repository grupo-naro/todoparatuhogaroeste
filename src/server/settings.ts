import 'server-only'
import { prisma } from '@/server/db'

export type StoreSettingsData = { reservationExpiryEnabled: boolean; reservationExpiryDays: number }

export async function getStoreSettings(): Promise<StoreSettingsData> {
  const row = await prisma.storeSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } })
  return { reservationExpiryEnabled: row.reservationExpiryEnabled, reservationExpiryDays: row.reservationExpiryDays }
}
