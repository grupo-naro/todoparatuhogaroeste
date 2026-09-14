// A los tests NUNCA les tiene que llegar `.env` real — `src/test/db.ts` hace
// TRUNCATE de las tablas entre corridas, y `.env` apunta a la base de Neon.
process.loadEnvFile('.env.test')
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// jsdom does not implement window.matchMedia. Components that call
// useMediaQuery/useIsWide/useIsDesktop (e.g. FastEntryGrid) crash without a
// stub. This default is a fallback baseline only — a per-test
// `vi.stubGlobal('matchMedia', ...)` still takes precedence within that test.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

// Vitest is not run with `globals: true`, so @testing-library/react does not
// auto-register its DOM cleanup. Without this, renders accumulate across tests
// in the same file and role queries match duplicate elements.
afterEach(() => cleanup())
