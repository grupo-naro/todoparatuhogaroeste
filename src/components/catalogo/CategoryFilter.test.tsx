import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/catalogo',
  useSearchParams: () => new URLSearchParams(''),
}))
import { CategoryFilter } from './CategoryFilter'

const categories = [{ value: 'c1', label: 'Sillones' }, { value: 'c2', label: 'Mesas' }]

describe('CategoryFilter', () => {
  it('empuja ?categoria= al elegir una categoría', async () => {
    render(<CategoryFilter categories={categories} />)
    await userEvent.selectOptions(screen.getByLabelText('Categoría'), 'c1')
    expect(push).toHaveBeenCalledWith(expect.stringContaining('categoria=c1'))
  })
})
