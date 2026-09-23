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
  it('ADMIN ve Productos, Categorías y Depósito', () => {
    const labels = navItemsFor('ADMIN').map((i) => i.label)
    expect(labels).toContain('Productos')
    expect(labels).toContain('Categorías')
    expect(labels).toContain('Depósito')
  })
  it('DEPOSITO ve Productos, Categorías y Depósito', () => {
    const labels = navItemsFor('DEPOSITO').map((i) => i.label)
    expect(labels).toContain('Productos')
    expect(labels).toContain('Categorías')
    expect(labels).toContain('Depósito')
  })
  it('VENDEDOR no ve Productos, Categorías ni Depósito', () => {
    const labels = navItemsFor('VENDEDOR').map((i) => i.label)
    expect(labels).not.toContain('Productos')
    expect(labels).not.toContain('Categorías')
    expect(labels).not.toContain('Depósito')
  })
  it('ADMIN y VENDEDOR ven Clientes', () => {
    expect(navItemsFor('ADMIN').map((i) => i.label)).toContain('Clientes')
    expect(navItemsFor('VENDEDOR').map((i) => i.label)).toContain('Clientes')
  })
  it('DEPOSITO no ve Clientes', () => {
    expect(navItemsFor('DEPOSITO').map((i) => i.label)).not.toContain('Clientes')
  })
})
