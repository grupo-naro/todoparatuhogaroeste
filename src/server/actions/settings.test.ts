import { describe, expect, it, beforeEach, vi } from 'vitest'
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/server/auth/guards', () => ({
  requireRole: vi.fn().mockResolvedValue({ sub: 'U', role: 'ADMIN', name: 'Admin', mustChangePassword: false }),
}))
import { prisma, resetDb } from '@/test/db'
import { requireRole } from '@/server/auth/guards'
import { getStoreSettings } from '@/server/settings'
import { updateStoreSettings } from './settings'

beforeEach(async () => { await resetDb() })

describe('updateStoreSettings', () => {
  it('por defecto la liberación automática está apagada, a 7 días', async () => {
    expect(await getStoreSettings()).toEqual({ reservationExpiryEnabled: false, reservationExpiryDays: 7 })
  })

  it('guarda el interruptor y los días', async () => {
    expect(await updateStoreSettings({ reservationExpiryEnabled: true, reservationExpiryDays: 15 })).toEqual({ ok: true })
    expect(await getStoreSettings()).toEqual({ reservationExpiryEnabled: true, reservationExpiryDays: 15 })
    expect(await prisma.storeSettings.count()).toBe(1)
  })

  it('exige rol ADMIN', async () => {
    await updateStoreSettings({ reservationExpiryEnabled: false, reservationExpiryDays: 7 })
    expect(vi.mocked(requireRole)).toHaveBeenCalledWith('ADMIN')
  })

  it('rechaza 0 o 366 días', async () => {
    expect((await updateStoreSettings({ reservationExpiryEnabled: true, reservationExpiryDays: 0 })).ok).toBe(false)
    expect((await updateStoreSettings({ reservationExpiryEnabled: true, reservationExpiryDays: 366 })).ok).toBe(false)
    expect(await prisma.storeSettings.count()).toBe(0)
  })
})
