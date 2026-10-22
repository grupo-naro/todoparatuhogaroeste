import { prisma } from '@/server/db'

export { prisma }

export async function resetDb(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "PrintJob","ProductImage","InventoryTransaction","InventoryStock","ProductVariant","Product","Category","User","Customer" RESTART IDENTITY CASCADE;',
  )
}
