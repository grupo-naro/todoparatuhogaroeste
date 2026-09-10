import './prisma/load-env'
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Vitest is not run with `globals: true`, so @testing-library/react does not
// auto-register its DOM cleanup. Without this, renders accumulate across tests
// in the same file and role queries match duplicate elements.
afterEach(() => cleanup())
