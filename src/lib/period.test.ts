import { describe, expect, it } from 'vitest'
import { getPeriodRange } from './period'

describe('getPeriodRange', () => {
  it('day: límites básicos un miércoles a media mañana en Argentina', () => {
    const now = new Date('2026-09-23T14:00:00Z') // 11:00 en Argentina
    const { from, to } = getPeriodRange('day', now)
    expect(from).toEqual(new Date('2026-09-23T03:00:00Z')) // medianoche argentina del mismo día
    expect(to).toEqual(now)
  })

  it('week: el mismo miércoles, arranca el lunes de esa semana', () => {
    const now = new Date('2026-09-23T14:00:00Z')
    const { from } = getPeriodRange('week', now)
    expect(from).toEqual(new Date('2026-09-21T03:00:00Z')) // lunes 21/09
  })

  it('month: el mismo miércoles, arranca el día 1 del mes', () => {
    const now = new Date('2026-09-23T14:00:00Z')
    const { from } = getPeriodRange('month', now)
    expect(from).toEqual(new Date('2026-09-01T03:00:00Z'))
  })

  it('day: un minuto antes de medianoche argentina todavía es el día anterior', () => {
    const now = new Date('2026-09-23T02:59:00Z') // 23:59 del 22/09 en Argentina
    const { from } = getPeriodRange('day', now)
    expect(from).toEqual(new Date('2026-09-22T03:00:00Z'))
  })

  it('day: exactamente en medianoche argentina, from coincide con now', () => {
    const now = new Date('2026-09-23T03:00:00Z') // 00:00 en Argentina
    const { from, to } = getPeriodRange('day', now)
    expect(from).toEqual(now)
    expect(to).toEqual(now)
  })

  it('day y month: la 1am UTC del día 1 todavía es el mes anterior en Argentina', () => {
    const now = new Date('2026-03-01T01:00:00Z') // 22:00 del 28/02 en Argentina
    expect(getPeriodRange('day', now).from).toEqual(new Date('2026-02-28T03:00:00Z'))
    expect(getPeriodRange('month', now).from).toEqual(new Date('2026-02-01T03:00:00Z'))
  })

  it('week: domingo va al lunes anterior, no al siguiente', () => {
    const now = new Date('2023-01-01T12:00:00Z') // domingo, 09:00 en Argentina
    const { from } = getPeriodRange('week', now)
    expect(from).toEqual(new Date('2022-12-26T03:00:00Z')) // lunes 26/12/2022
  })

  it('week: cruza fin de mes correctamente', () => {
    const now = new Date('2026-03-01T12:00:00Z') // domingo, 09:00 en Argentina
    const { from } = getPeriodRange('week', now)
    expect(from).toEqual(new Date('2026-02-23T03:00:00Z')) // lunes 23/02
  })

  it('sin "now" explícito, usa la hora actual real', () => {
    const before = Date.now()
    const { to } = getPeriodRange('day')
    expect(to.getTime()).toBeGreaterThanOrEqual(before)
  })
})
