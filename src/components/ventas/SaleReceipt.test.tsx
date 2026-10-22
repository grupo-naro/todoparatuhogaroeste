import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToastProvider } from '@/components/ui/toast'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/server/actions/sales', () => ({ cancelSale: vi.fn() }))

import { SaleReceipt } from './SaleReceipt'

const sale = {
  id: 's1', number: 12, createdAt: new Date('2026-10-22T15:00:00.000Z'), userName: 'Ana',
  paymentMethod: 'EFECTIVO' as const, total: 600, cancelledAt: null, cancelledByName: null,
  items: [{ variantId: 'v1', productName: 'Sillón Milán', variantName: '2 cuerpos', quantity: 2, unitPrice: 300, subtotal: 600 }],
}

const renderReceipt = () => render(<ToastProvider><SaleReceipt sale={sale} /></ToastProvider>)

describe('SaleReceipt', () => {
  it('no imprime solo al abrirse (lo hace la estación del local)', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {})
    renderReceipt()
    expect(printSpy).not.toHaveBeenCalled()
  })

  it('el botón "Imprimir" manual sigue imprimiendo', async () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {})
    renderReceipt()
    await userEvent.click(screen.getByRole('button', { name: 'Imprimir' }))
    expect(printSpy).toHaveBeenCalledTimes(1)
  })

  it('muestra el ticket y ofrece anular una venta vigente', () => {
    renderReceipt()
    expect(screen.getByRole('heading', { name: 'Ticket N° 12' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Anular venta' })).toBeInTheDocument()
  })
})
