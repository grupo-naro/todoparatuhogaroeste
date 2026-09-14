// Aplica las migraciones a la base de test (docker-compose.yml, servicio
// `db-test`) sin tocar el `DATABASE_URL` real de `.env`. `process.loadEnvFile`
// no pisa una variable ya seteada (ver prisma/load-env.ts para el mismo
// patrón), así que alcanza con cargar `.env.test` antes de invocar Prisma.
import { execSync } from 'node:child_process'

process.loadEnvFile('.env.test')
execSync('pnpm exec prisma migrate deploy', { stdio: 'inherit', env: process.env })
