import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(''),
}))
import { PeriodSelector } from './PeriodSelector'

describe('PeriodSelector', () => {
  it('marca el período actual como presionado', () => {
    render(<PeriodSelector period="week" />)
    expect(screen.getByRole('button', { name: 'Semana' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Hoy' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('empuja ?period=month al hacer click en Mes', async () => {
    render(<PeriodSelector period="day" />)
    await userEvent.click(screen.getByRole('button', { name: 'Mes' }))
    expect(push).toHaveBeenCalledWith('/?period=month')
  })
})
