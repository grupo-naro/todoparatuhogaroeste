import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FastEntryGrid, validateRow } from './FastEntryGrid'

const noop = vi.fn().mockResolvedValue({ batchId: 'b', saved: 0, failed: 0, results: [] })
const FastEntryGridHarness = () => <FastEntryGrid mode="table" onSubmit={noop} />

describe('validateRow', () => {
  const base = { key: 'r1', variant: { variantId: 'v1', productName: 'P', variantName: 'V', categoryName: 'C' }, counted: '5' }
  it('ok cuando hay variante y cantidad entera', () => {
    expect(validateRow(base, [base])).toBeUndefined()
  })
  it('exige seleccionar variante', () => {
    expect(validateRow({ ...base, variant: null }, [])).toBe('Seleccioná un producto/variante')
  })
  it('rechaza cantidad no entera o negativa', () => {
    expect(validateRow({ ...base, counted: '2.5' }, [base])).toBe('Cantidad inválida')
    expect(validateRow({ ...base, counted: '-1' }, [base])).toBe('Cantidad inválida')
    expect(validateRow({ ...base, counted: '' }, [base])).toBe('Cantidad inválida')
  })
  it('detecta variante duplicada en una fila anterior', () => {
    const r2 = { ...base, key: 'r2' }
    expect(validateRow(r2, [base, r2])).toBe('Ya está en la fila 1')
  })
})

describe('FastEntryGrid (modo tabla)', () => {
  it('Enter en Cantidad agrega una fila nueva', async () => {
    render(<FastEntryGridHarness />)
    const inputs = () => screen.getAllByPlaceholderText('Buscar producto…')
    expect(inputs()).toHaveLength(1)
    await userEvent.type(screen.getByLabelText('Cantidad (fila 1)'), '3{Enter}')
    expect(inputs()).toHaveLength(2)
  })
  it('al guardar, llama onSubmit solo con filas válidas y muestra el resumen', async () => {
    const onSubmit = vi.fn().mockResolvedValue({ batchId: 'b', saved: 1, failed: 0, results: [] })
    render(<FastEntryGrid mode="table" onSubmit={onSubmit} initialRows={[
      { key: 'r1', variant: { variantId: 'v1', productName: 'P', variantName: 'V', categoryName: 'C' }, counted: '4' },
      { key: 'r2', variant: null, counted: '' },
    ]} />)
    await userEvent.click(screen.getByRole('button', { name: /Guardar lote/ }))
    expect(onSubmit).toHaveBeenCalledWith([{ variantId: 'v1', counted: 4 }])
    expect(await screen.findByText('1 guardadas, 1 con error')).toBeInTheDocument()
  })
})

describe('FastEntryGrid (modo tarjeta)', () => {
  it('sin tabla; muestra tarjetas con stepper y "Agregar ítem"', () => {
    render(<FastEntryGrid mode="card" onSubmit={noop} initialRows={[
      { key: 'r1', variant: { variantId: 'v1', productName: 'P', variantName: 'V', categoryName: 'C' }, counted: '2' },
    ]} />)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sumar uno (ítem 1)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Agregar ítem' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Guardar lote/ })).toBeInTheDocument()
  })
  it('＋ incrementa la cantidad de la tarjeta', async () => {
    render(<FastEntryGrid mode="card" onSubmit={noop} initialRows={[
      { key: 'r1', variant: { variantId: 'v1', productName: 'P', variantName: 'V', categoryName: 'C' }, counted: '2' },
    ]} />)
    await userEvent.click(screen.getByRole('button', { name: 'Sumar uno (ítem 1)' }))
    expect(screen.getByLabelText('Cantidad (ítem 1)')).toHaveValue('3')
  })
})
