export type Period = 'day' | 'week' | 'month'

const AR_OFFSET_MS = 3 * 60 * 60 * 1000 // Argentina = UTC-3, sin horario de verano

export function getPeriodRange(period: Period, now: Date = new Date()): { from: Date; to: Date } {
  const arNow = new Date(now.getTime() - AR_OFFSET_MS)
  const from = new Date(Date.UTC(arNow.getUTCFullYear(), arNow.getUTCMonth(), arNow.getUTCDate()))

  if (period === 'week') {
    // Lunes como inicio de semana. getUTCDay(): 0=domingo..6=sábado.
    const dayOfWeek = from.getUTCDay()
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    from.setUTCDate(from.getUTCDate() - diffToMonday)
  } else if (period === 'month') {
    from.setUTCDate(1)
  }

  return { from: new Date(from.getTime() + AR_OFFSET_MS), to: now }
}
