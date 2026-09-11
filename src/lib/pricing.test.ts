import { describe, expect, it } from 'vitest'
import { effectiveCost, effectivePrice, variantDisplayName } from './pricing'

describe('effectiveCost / effectivePrice', () => {
  it('usa el valor de la variante si existe', () => {
    expect(effectiveCost({ cost: 100 }, { defaultCost: 80 })).toBe(100)
  })
  it('hereda del producto si la variante es null', () => {
    expect(effectiveCost({ cost: null }, { defaultCost: 80 })).toBe(80)
    expect(effectivePrice({ price: null }, { defaultPrice: 200 })).toBe(200)
  })
  it('devuelve null si ninguno tiene valor', () => {
    expect(effectiveCost({ cost: null }, { defaultCost: null })).toBeNull()
  })
})

describe('variantDisplayName', () => {
  it('usa name si viene', () => {
    expect(variantDisplayName({ name: 'Custom', medida: '2m' })).toBe('Custom')
  })
  it('junta medida · tela · color no vacíos', () => {
    expect(variantDisplayName({ medida: '2 cuerpos', tela: 'Chenille', color: 'Gris' }))
      .toBe('2 cuerpos · Chenille · Gris')
    expect(variantDisplayName({ medida: '2 cuerpos', color: 'Gris' })).toBe('2 cuerpos · Gris')
  })
  it('cae en "Única" si todo está vacío', () => {
    expect(variantDisplayName({})).toBe('Única')
  })
})
