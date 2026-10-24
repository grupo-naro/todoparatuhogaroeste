'use server'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/server/db'
import { requireRole } from '@/server/auth/guards'
import { storeSettingsSchema } from '@/server/validation/settings'

export async function updateStoreSettings(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireRole('ADMIN')
  const parsed = storeSettingsSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  await prisma.storeSettings.upsert({ where: { id: 1 }, update: parsed.data, create: { id: 1, ...parsed.data } })
  revalidatePath('/configuracion')
  return { ok: true }
}
