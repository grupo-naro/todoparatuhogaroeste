import 'server-only'
import { prisma } from '@/server/db'

export async function listCategories() {
  const rows = await prisma.category.findMany({
    where: { archivedAt: null },
    orderBy: { name: 'asc' },
    include: { _count: { select: { products: true } } },
  })
  return rows.map(({ _count, ...c }) => ({ ...c, activeProductCount: _count.products }))
}

export async function listCategoryOptions() {
  const rows = await prisma.category.findMany({ where: { archivedAt: null }, orderBy: { name: 'asc' } })
  return rows.map((c) => ({ value: c.id, label: c.name }))
}
