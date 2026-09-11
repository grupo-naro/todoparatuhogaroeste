import '../load-env.ts'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

async function main() {
  const variants = await prisma.productVariant.findMany({ include: { stock: true } })
  let issues = 0
  for (const v of variants) {
    const agg = await prisma.inventoryTransaction.aggregate({
      where: { variantId: v.id }, _sum: { quantityDelta: true },
    })
    const ledger = agg._sum.quantityDelta ?? 0
    const snapshot = v.stock?.quantity ?? 0
    if (ledger !== snapshot) {
      issues++
      console.log(`DISCREPANCIA ${v.id} (${v.name}): snapshot=${snapshot} ledger=${ledger}`)
    }
  }
  console.log(issues === 0 ? 'OK: sin discrepancias' : `${issues} discrepancia(s)`)
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error(e); await prisma.$disconnect(); process.exit(1)
})
