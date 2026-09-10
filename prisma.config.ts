import { defineConfig, env } from 'prisma/config'

// Prisma 7 no longer auto-loads `.env` when a config file is present.
// Node >= 20.12 ships `process.loadEnvFile`; ignore if the file is absent
// (e.g. CI/build where the vars are already in the environment).
try {
  process.loadEnvFile()
} catch {
  // no local .env file — rely on the ambient environment
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node --experimental-strip-types prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
})
