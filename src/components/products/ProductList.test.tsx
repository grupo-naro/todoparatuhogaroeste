import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProductList } from './ProductList'

const rows = [{ id: 'p1', name: 'Sillón Milán', categoryName: 'Sillones', variantCount: 2, defaultCost: 100, defaultPrice: 250, coverImageUrl: null }]

describe('ProductList', () => {
  it('renderiza tanto la tabla como la lista de tarjetas (visibilidad por CSS)', () => {
    render(<ProductList rows={rows} />)
    // link al detalle aparece en ambas representaciones
    expect(screen.getAllByRole('link', { name: 'Sillón Milán' }).length).toBeGreaterThanOrEqual(2)
    expect(screen.getByRole('table')).toBeInTheDocument()
  })
  it('muestra mensaje vacío', () => {
    render(<ProductList rows={[]} />)
    expect(screen.getAllByText('Sin resultados').length).toBeGreaterThanOrEqual(1)
  })
  it('muestra la miniatura de portada cuando el producto tiene coverImageUrl', () => {
    const withCover = [{ ...rows[0], coverImageUrl: 'https://blob.example/cover.jpg' }]
    render(<ProductList rows={withCover} />)
    expect(screen.getAllByAltText('').length).toBeGreaterThan(0)
  })
})
