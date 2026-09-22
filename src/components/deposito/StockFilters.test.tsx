import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/deposito',
  useSearchParams: () => new URLSearchParams(''),
}))
import { StockFilters } from './StockFilters'

describe('StockFilters', () => {
  it('empuja status al elegir "Sin stock"', async () => {
    render(<StockFilters categories={[]} />)
    await userEvent.selectOptions(screen.getByLabelText('Estado'), 'sin_stock')
    expect(push).toHaveBeenCalledWith(expect.stringContaining('status=sin_stock'))
  })
})
