import { describe, expect, it } from 'vitest'
import { money, integer, formatDate } from './format'

const nbsp = (s: string) => s.replace(/[  ]/g, ' ')

describe('money', () => {
  it('formatea ARS', () => { expect(nbsp(money(1234.5))).toBe('$ 1.234,50') })
  it('— para null/undefined/vacío', () => {
    expect(money(null)).toBe('—'); expect(money(undefined)).toBe('—'); expect(money('')).toBe('—')
  })
  it('acepta strings decimales', () => { expect(nbsp(money('1000'))).toBe('$ 1.000,00') })
})

describe('integer', () => {
  it('agrupa miles', () => { expect(integer(12000)).toBe('12.000') })
  it('0 para null', () => { expect(integer(null)).toBe('0') })
})

describe('formatDate', () => {
  it('dd/MM/yyyy HH:mm', () => {
    expect(formatDate(new Date('2026-09-10T17:30:00Z'))).toBe('10/09/2026 14:30')
  })
  it('maneja medianoche (00:00) correctamente', () => {
    expect(formatDate(new Date('2026-09-10T03:00:00Z'))).toBe('10/09/2026 00:00')
  })
})
