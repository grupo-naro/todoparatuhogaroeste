import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Home } from 'lucide-react'

vi.mock('next/navigation', () => ({ usePathname: () => '/deposito' }))
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
import { NavLink } from './NavLink'

const item = (href: string, label: string) => ({ href, label, icon: Home })

describe('NavLink', () => {
  it('marca aria-current cuando la ruta coincide', () => {
    render(<NavLink item={item('/deposito', 'Depósito')} />)
    expect(screen.getByRole('link', { name: 'Depósito' })).toHaveAttribute('aria-current', 'page')
  })
  it('no marca aria-current en otra ruta', () => {
    render(<NavLink item={item('/productos', 'Productos')} />)
    expect(screen.getByRole('link', { name: 'Productos' })).not.toHaveAttribute('aria-current')
  })
  it('llama onNavigate al hacer click', async () => {
    const onNavigate = vi.fn()
    render(<NavLink item={item('/productos', 'Productos')} onNavigate={onNavigate} />)
    screen.getByRole('link', { name: 'Productos' }).click()
    expect(onNavigate).toHaveBeenCalled()
  })
})
