import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from './password'

describe('password', () => {
  it('un hash verifica contra su texto plano', async () => {
    const hash = await hashPassword('secreto123')
    expect(hash).not.toBe('secreto123')
    expect(await verifyPassword('secreto123', hash)).toBe(true)
  })
  it('rechaza una contraseña incorrecta', async () => {
    const hash = await hashPassword('secreto123')
    expect(await verifyPassword('otra', hash)).toBe(false)
  })
})
