import { describe, expect, it } from 'vitest'
import { buildReservationNotice, buildWhatsappLink } from './whatsapp'

describe('buildWhatsappLink', () => {
  it('arma la URL con el número fijo y el texto esperado, codificado', () => {
    const url = buildWhatsappLink('Sillón Milán', '2 cuerpos · Tela A · Azul')
    expect(url).toBe(
      'https://wa.me/5491126039383?text=' +
      encodeURIComponent('Hola! Quiero consultar por Sillón Milán (2 cuerpos · Tela A · Azul)'),
    )
  })

  it('codifica tildes y espacios; los paréntesis quedan literales (encodeURIComponent no los codifica, y son válidos en la query string)', () => {
    const url = buildWhatsappLink('Ropero a medida', 'Única')
    expect(url).toContain('Ropero%20a%20medida')
    expect(url).toContain('(%C3%9Anica)') // paréntesis literales alrededor de "Única" codificada (Ú → %C3%9A, resto sin cambios)
  })
})

describe('buildReservationNotice', () => {
  it('arma el link con el teléfono en formato 549 y el aviso con el nombre y el número', () => {
    const url = buildReservationNotice('11 2345-6789', 'Luna', 7)
    expect(url.startsWith('https://wa.me/5491123456789?text=')).toBe(true)
    expect(decodeURIComponent(url.split('?text=')[1])).toContain('Hola Luna!')
    expect(decodeURIComponent(url.split('?text=')[1])).toContain('reserva N° 7')
  })

  it('no duplica el prefijo si ya viene con 54 y quita el 0 inicial', () => {
    expect(buildReservationNotice('+54 9 11 2345-6789', null, 1)).toContain('wa.me/5491123456789')
    expect(buildReservationNotice('011 2345-6789', null, 1)).toContain('wa.me/549112345678')
  })

  it('sin nombre saluda sin nombre', () => {
    const text = decodeURIComponent(buildReservationNotice('1123456789', null, 3).split('?text=')[1])
    expect(text.startsWith('Hola! ')).toBe(true)
  })
})
