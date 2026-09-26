import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProductCard } from './ProductCard'
import { buildWhatsappLink } from '@/lib/whatsapp'
import type { PublicCatalogProduct } from '@/server/queries/catalog'

const product: PublicCatalogProduct = {
  id: 'p1', name: 'Sillón Milán',
  images: [{ url: 'https://example.com/foto.jpg' }],
  variants: [
    { id: 'v1', name: '2 cuerpos', disponible: true },
    { id: 'v2', name: '3 cuerpos', disponible: false },
  ],
}

describe('ProductCard', () => {
  it('muestra el nombre del producto y de cada variante', () => {
    render(<ProductCard product={product} />)
    expect(screen.getByText('Sillón Milán')).toBeInTheDocument()
    expect(screen.getByText('2 cuerpos')).toBeInTheDocument()
    expect(screen.getByText('3 cuerpos')).toBeInTheDocument()
  })

  it('muestra "Agotado" solo en la variante sin stock', () => {
    render(<ProductCard product={product} />)
    expect(screen.getAllByText('Agotado')).toHaveLength(1)
  })

  it('el link de WhatsApp de cada variante usa buildWhatsappLink con el producto y esa variante', () => {
    render(<ProductCard product={product} />)
    const links = screen.getAllByRole('link', { name: 'Consultar por WhatsApp' })
    expect(links[0]).toHaveAttribute('href', buildWhatsappLink('Sillón Milán', '2 cuerpos'))
    expect(links[1]).toHaveAttribute('href', buildWhatsappLink('Sillón Milán', '3 cuerpos'))
  })

  it('sin fotos, no renderiza ninguna imagen (muestra el placeholder)', () => {
    render(<ProductCard product={{ ...product, images: [] }} />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})
