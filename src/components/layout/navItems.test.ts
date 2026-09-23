import { describe, expect, it } from 'vitest'
import { navItemsFor } from './navItems'

describe('navItemsFor', () => {
  it('ADMIN ve todo, incluida Ventas y Usuarios', () => {
    const labels = navItemsFor('ADMIN').map((i) => i.label)
    expect(labels).toContain('Ventas')
    expect(labels).toContain('Usuarios')
  })
  it('VENDEDOR ve Ventas pero no Usuarios', () => {
    const labels = navItemsFor('VENDEDOR').map((i) => i.label)
    expect(labels).toContain('Ventas')
    expect(labels).not.toContain('Usuarios')
  })
  it('DEPOSITO no ve Ventas ni Usuarios', () => {
    const labels = navItemsFor('DEPOSITO').map((i) => i.label)
    expect(labels).not.toContain('Ventas')
    expect(labels).not.toContain('Usuarios')
  })
})
