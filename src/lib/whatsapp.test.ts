import { describe, expect, it } from 'vitest'
import { buildWhatsappLink } from './whatsapp'

describe('buildWhatsappLink', () => {
  it('arma la URL con el número fijo y el texto esperado, codificado', () => {
    const url = buildWhatsappLink('Sillón Milán', '2 cuerpos · Tela A · Azul')
    expect(url).toBe(
      'https://wa.me/5491126039383?text=' +
      encodeURIComponent('Hola! Quiero consultar por Sillón Milán (2 cuerpos · Tela A · Azul)').replace(/\(/g, '%28').replace(/\)/g, '%29'),
    )
  })

  it('codifica tildes, espacios y paréntesis correctamente', () => {
    const url = buildWhatsappLink('Ropero a medida', 'Única')
    expect(url).toContain('Ropero%20a%20medida')
    expect(url).toContain('%C3%9Anica') // "Única" con Ú codificada
    expect(url).toContain('%28') // (
    expect(url).toContain('%29') // )
  })
})
