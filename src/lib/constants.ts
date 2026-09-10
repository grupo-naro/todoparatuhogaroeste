export const ROLES = ['ADMIN', 'DEPOSITO'] as const
export type RoleName = (typeof ROLES)[number]

export const TRANSACTION_TYPES = ['CARGA_INICIAL', 'AJUSTE'] as const
export type TransactionTypeName = (typeof TRANSACTION_TYPES)[number]

export const SEED_CATEGORIES = [
  'Somieres', 'Respaldos', 'Sillones', 'Mesas', 'Sillas', 'Muebles a medida / Otros',
] as const

export const BREAKPOINTS = { md: '(min-width: 768px)', lg: '(min-width: 1024px)' } as const
