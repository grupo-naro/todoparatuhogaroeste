const ARS = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 })
const INT = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })
const DATE = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, hourCycle: 'h23',
  timeZone: 'America/Argentina/Buenos_Aires',
})

export function money(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  const n = typeof value === 'string' ? Number(value) : value
  return Number.isNaN(n) ? '—' : ARS.format(n)
}

export function integer(value: number | null | undefined): string {
  return value === null || value === undefined ? '0' : INT.format(value)
}

export function formatDate(value: Date | string): string {
  const d = typeof value === 'string' ? new Date(value) : value
  return DATE.format(d).replace(/,/g, '')
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}
