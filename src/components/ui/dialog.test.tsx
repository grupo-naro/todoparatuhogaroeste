import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Dialog } from './dialog'

describe('Dialog', () => {
  it('renderiza título y contenido cuando open', () => {
    render(<Dialog open onOpenChange={vi.fn()} title="Ajustar stock"><p>cuerpo</p></Dialog>)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Ajustar stock')).toBeInTheDocument()
    expect(screen.getByText('cuerpo')).toBeInTheDocument()
  })
  it('el contenido lleva las clases de bottom-sheet en móvil y centrado en sm', () => {
    render(<Dialog open onOpenChange={vi.fn()} title="X"><p>y</p></Dialog>)
    const content = screen.getByRole('dialog')
    expect(content.className).toMatch(/bottom-0/)      // sheet en móvil
    expect(content.className).toMatch(/sm:/)           // se re-centra en ≥ sm
  })
})
