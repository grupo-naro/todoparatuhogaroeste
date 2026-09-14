import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('next/navigation', () => ({ usePathname: () => '/productos' }))
vi.mock('next/link', () => ({
  default: ({ children, href, onClick, ...props }: ComponentProps<'a'>) => (
    <a
      href={typeof href === 'string' ? href : '#'}
      onClick={(e) => {
        e.preventDefault()
        onClick?.(e)
      }}
      {...props}
    >
      {children}
    </a>
  ),
}))
import { NavDrawer } from './NavDrawer'

describe('NavDrawer', () => {
  it('abre con el botón y muestra los ítems de navegación', async () => {
    render(<NavDrawer role="DEPOSITO" />)
    await userEvent.click(screen.getByRole('button', { name: 'Abrir menú' }))
    expect(screen.getByRole('link', { name: 'Productos' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Categorías' })).toBeInTheDocument()
  })
  it('al navegar se cierra el drawer', async () => {
    render(<NavDrawer role="ADMIN" />)
    await userEvent.click(screen.getByRole('button', { name: 'Abrir menú' }))
    const productos = screen.getByRole('link', { name: 'Productos' })
    await userEvent.click(productos)
    expect(screen.queryByRole('link', { name: 'Productos' })).not.toBeInTheDocument()
  })
})
