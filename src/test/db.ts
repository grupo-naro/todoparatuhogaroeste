import { prisma } from '@/server/db'

export { prisma }

export async function resetDb(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "InventoryTransaction","InventoryStock","ProductVariant","Product","Category","User" RESTART IDENTITY CASCADE;',
  )
}
