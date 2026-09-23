import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatCard } from './StatCard'

describe('StatCard', () => {
  it('muestra el label y el valor', () => {
    render(<StatCard label="Ventas" value="12" />)
    expect(screen.getByText('Ventas')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
  })
})
