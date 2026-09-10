import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // Serialize test FILES: several integration suites TRUNCATE the same
    // `gestion` DB; without this their resets race across workers.
    fileParallelism: false,
  },
  resolve: { alias: {
    '@': fileURLToPath(new URL('./src', import.meta.url)),
    'server-only': fileURLToPath(new URL('./src/test/empty.ts', import.meta.url)),
  } },
})
