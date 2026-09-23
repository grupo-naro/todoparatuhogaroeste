export const ROLES = ['ADMIN', 'DEPOSITO', 'VENDEDOR'] as const
export type RoleName = (typeof ROLES)[number]

export const TRANSACTION_TYPES = ['CARGA_INICIAL', 'AJUSTE', 'VENTA', 'ANULACION'] as const
export type TransactionTypeName = (typeof TRANSACTION_TYPES)[number]

export const PAYMENT_METHODS = ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'] as const
export type PaymentMethodName = (typeof PAYMENT_METHODS)[number]

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodName, string> = {
  EFECTIVO: 'Efectivo', TARJETA: 'Tarjeta', TRANSFERENCIA: 'Transferencia',
}

export const SEED_CATEGORIES = [
  'Somieres', 'Respaldos', 'Sillones', 'Mesas', 'Sillas', 'Muebles a medida / Otros',
] as const

export const BREAKPOINTS = { md: '(min-width: 768px)', lg: '(min-width: 1024px)' } as const
