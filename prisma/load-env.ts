// Prisma 7 no longer auto-loads `.env` for the CLI, standalone scripts, or the
// test runner. Import this module for its side effect before anything reads
// `process.env.DATABASE_URL`. try/catch covers CI where the vars are ambient.
try {
  process.loadEnvFile()
} catch {
  // no local .env file
}
