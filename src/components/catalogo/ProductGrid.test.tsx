import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProductGrid } from './ProductGrid'
import type { PublicCatalogProduct } from '@/server/queries/catalog'

describe('ProductGrid', () => {
  it('muestra una tarjeta por producto', () => {
    const products: PublicCatalogProduct[] = [
      { id: 'p1', name: 'Sillón Milán', images: [], variants: [{ id: 'v1', name: 'A', disponible: true }] },
      { id: 'p2', name: 'Mesa Roble', images: [], variants: [{ id: 'v2', name: 'A', disponible: true }] },
    ]
    render(<ProductGrid products={products} />)
    expect(screen.getByText('Sillón Milán')).toBeInTheDocument()
    expect(screen.getByText('Mesa Roble')).toBeInTheDocument()
  })

  it('sin productos, muestra el mensaje de categoría vacía', () => {
    render(<ProductGrid products={[]} />)
    expect(screen.getByText('No hay productos en esta categoría')).toBeInTheDocument()
  })
})
