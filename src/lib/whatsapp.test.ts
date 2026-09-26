import { describe, expect, it } from 'vitest'
import { buildWhatsappLink } from './whatsapp'

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
