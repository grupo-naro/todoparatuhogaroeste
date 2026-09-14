import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VariantRows, type VariantRow } from './VariantRows'

function Wrapper({ defaultCost, defaultPrice }: { defaultCost?: string; defaultPrice?: string }) {
  const [rows, setRows] = useState<VariantRow[]>([])
  return <VariantRows value={rows} onChange={setRows} defaultCost={defaultCost} defaultPrice={defaultPrice} />
}

describe('VariantRows', () => {
  it('agregar variante copia medida/tela/color/costo/precio de la última fila, pero no el SKU', async () => {
    render(<Wrapper />)
    await userEvent.click(screen.getByRole('button', { name: 'Agregar variante' }))
    await userEvent.type(screen.getByLabelText('Medida (fila 1)'), '1,40m')
    await userEvent.type(screen.getByLabelText('Tela (fila 1)'), 'Pana')
    await userEvent.type(screen.getByLabelText('Color (fila 1)'), 'Rojo')
    await userEvent.type(screen.getByLabelText('Costo (fila 1)'), '100')
    await userEvent.type(screen.getByLabelText('Precio (fila 1)'), '200')
    await userEvent.type(screen.getByLabelText('SKU (fila 1)'), 'SKU-ROJO')

    await userEvent.click(screen.getByRole('button', { name: 'Agregar variante' }))

    expect(screen.getByLabelText('Medida (fila 2)')).toHaveValue('1,40m')
    expect(screen.getByLabelText('Tela (fila 2)')).toHaveValue('Pana')
    expect(screen.getByLabelText('Color (fila 2)')).toHaveValue('Rojo')
    expect(screen.getByLabelText('Costo (fila 2)')).toHaveValue('100')
    expect(screen.getByLabelText('Precio (fila 2)')).toHaveValue('200')
    expect(screen.getByLabelText('SKU (fila 2)')).toHaveValue('')
  })

  it('escribir sobre un campo precargado reemplaza el valor en vez de agregarlo al final', async () => {
    render(<Wrapper />)
    await userEvent.click(screen.getByRole('button', { name: 'Agregar variante' }))
    await userEvent.type(screen.getByLabelText('Color (fila 1)'), 'Negro')
    await userEvent.click(screen.getByRole('button', { name: 'Agregar variante' }))
    // La fila 2 arranca con "Negro" copiado de la fila 1; el usuario hace click
    // y tipea el color nuevo sin borrar primero — debe reemplazar, no concatenar.
    await userEvent.type(screen.getByLabelText('Color (fila 2)'), 'Gris')
    expect(screen.getByLabelText('Color (fila 2)')).toHaveValue('Gris')
  })

  it('la primera fila usa el costo/precio por defecto del producto cuando se pasan como prop', async () => {
    render(<Wrapper defaultCost="50" defaultPrice="90" />)
    await userEvent.click(screen.getByRole('button', { name: 'Agregar variante' }))
    expect(screen.getByLabelText('Costo (fila 1)')).toHaveValue('50')
    expect(screen.getByLabelText('Precio (fila 1)')).toHaveValue('90')
    expect(screen.getByLabelText('Medida (fila 1)')).toHaveValue('')
  })

  it('permite cargar el stock inicial por fila', async () => {
    render(<Wrapper />)
    await userEvent.click(screen.getByRole('button', { name: 'Agregar variante' }))
    expect(screen.getByLabelText('Stock inicial (fila 1)')).toHaveValue('')
    await userEvent.type(screen.getByLabelText('Stock inicial (fila 1)'), '5')
    expect(screen.getByLabelText('Stock inicial (fila 1)')).toHaveValue('5')
  })

  it('el stock inicial NO se copia a la fila nueva, a diferencia de medida', async () => {
    render(<Wrapper />)
    await userEvent.click(screen.getByRole('button', { name: 'Agregar variante' }))
    await userEvent.type(screen.getByLabelText('Medida (fila 1)'), '1,40m')
    await userEvent.type(screen.getByLabelText('Stock inicial (fila 1)'), '5')

    await userEvent.click(screen.getByRole('button', { name: 'Agregar variante' }))

    expect(screen.getByLabelText('Medida (fila 2)')).toHaveValue('1,40m')
    expect(screen.getByLabelText('Stock inicial (fila 2)')).toHaveValue('')
  })
})
