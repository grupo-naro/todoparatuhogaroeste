import { describe, expect, it } from 'vitest'
import { normalizePhone } from './phone'

describe('normalizePhone', () => {
  it('deja solo dígitos', () => {
    expect(normalizePhone('11 2345-6789')).toBe('1123456789')
    expect(normalizePhone('(11) 2345-6789')).toBe('1123456789')
  })
  it('ya normalizado queda igual', () => {
    expect(normalizePhone('1123456789')).toBe('1123456789')
  })
  it('vacío o sin dígitos da vacío', () => {
    expect(normalizePhone('')).toBe('')
    expect(normalizePhone('abc')).toBe('')
  })
})
