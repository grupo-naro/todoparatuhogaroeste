import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/catalogo',
  useSearchParams: () => new URLSearchParams(''),
}))
import { CatalogFilters } from './CatalogFilters'

const categories = [{ value: 'c1', label: 'Sillones' }, { value: 'c2', label: 'Mesas' }]

describe('CatalogFilters', () => {
  it('empuja ?categoria= al elegir una categoría (con debounce)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ delay: null })
    render(<CatalogFilters categories={categories} />)
    await user.selectOptions(screen.getByLabelText('Categoría'), 'c1')
    await vi.advanceTimersByTimeAsync(350)
    expect(push).toHaveBeenCalledWith(expect.stringContaining('categoria=c1'))
    vi.useRealTimers()
  })

  it('empuja ?q= al tipear en el buscador (con debounce)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ delay: null })
    render(<CatalogFilters categories={categories} />)
    await user.type(screen.getByLabelText('Buscar producto'), 'milán')
    await vi.advanceTimersByTimeAsync(350)
    expect(push).toHaveBeenCalledWith(expect.stringContaining('q=mil'))
    vi.useRealTimers()
  })
})
