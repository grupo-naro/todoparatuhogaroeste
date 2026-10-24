import type { ReservationDetail } from '@/server/queries/reservations'

export function reservationDetail(over: Partial<ReservationDetail> = {}): ReservationDetail {
  return {
    id: 'r1', number: 7, status: 'ESPERANDO', userName: 'Ana', customerName: 'Luna Paz', customerPhone: '1123456789',
    shippingAddress: 'Av. Siempreviva 742', note: null,
    createdAt: new Date('2026-10-24T15:00:00.000Z'), readyAt: null, closedAt: null, notifiedAt: null,
    saleId: null, depositResolution: null,
    items: [
      { variantId: 'v1', productName: 'Mesa', variantName: 'Roble', quantity: 1, allocated: 1, unitPrice: 500, currentPrice: 500 },
      { variantId: 'v2', productName: 'Silla', variantName: 'Terciopelo verde', quantity: 6, allocated: 2, unitPrice: 80, currentPrice: 80 },
    ],
    payments: [{ id: 'p1', kind: 'SENA', amount: 300, paymentMethod: 'EFECTIVO', createdAt: new Date('2026-10-24T15:00:00.000Z'), userName: 'Ana' }],
    depositBalance: 300, discount: 0, discountReason: null,
    ...over,
  }
}
