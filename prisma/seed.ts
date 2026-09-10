import './load-env.ts'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })
const CATEGORIES = ['Somieres', 'Respaldos', 'Sillones', 'Mesas', 'Sillas', 'Muebles a medida / Otros']
const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

async function main() {
  for (const name of CATEGORIES) {
    await prisma.category.upsert({ where: { name }, update: {}, create: { name, slug: slugify(name) } })
  }
  const email = process.env.SEED_ADMIN_EMAIL
  const password = process.env.SEED_ADMIN_PASSWORD
  if (email && password) {
    await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, name: 'Administrador', role: 'ADMIN', passwordHash: await bcrypt.hash(password, 10) },
    })
  }
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error(e); await prisma.$disconnect(); process.exit(1)
})
