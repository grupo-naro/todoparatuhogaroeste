import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(''),
  usePathname: () => '/productos',
}))
import { ProductFilters } from './ProductFilters'

describe('ProductFilters', () => {
  it('empuja el query param q al tipear (con debounce)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ delay: null })
    render(<ProductFilters categories={[]} />)
    await user.type(screen.getByPlaceholderText('Buscar producto…'), 'oslo')
    await vi.advanceTimersByTimeAsync(350)
    expect(push).toHaveBeenCalledWith(expect.stringContaining('q=oslo'))
    vi.useRealTimers()
  })
})
