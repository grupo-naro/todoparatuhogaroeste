// @vitest-environment node
import { describe, expect, it, beforeAll } from 'vitest'
import { signSession, verifySessionToken } from './session'

beforeAll(() => { process.env.AUTH_SECRET = 'test-secret-para-vitest-1234567890' })

describe('session token', () => {
  it('firma y verifica un payload', async () => {
    const token = await signSession({ sub: 'u1', role: 'ADMIN', name: 'Ana' })
    expect(await verifySessionToken(token)).toMatchObject({ sub: 'u1', role: 'ADMIN', name: 'Ana' })
  })
  it('devuelve null para un token corrupto', async () => {
    expect(await verifySessionToken('no.es.jwt')).toBeNull()
  })
})
