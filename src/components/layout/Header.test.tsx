import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({ usePathname: () => '/ventas' }))
import { Header } from './Header'

describe('Header', () => {
  it('el logo es un link a "/"', () => {
    render(<Header userName="Ana" role="ADMIN" />)
    const logo = screen.getByAltText('Jael Castillo — Todo para tu Hogar')
    expect(logo.closest('a')).toHaveAttribute('href', '/')
  })
})
