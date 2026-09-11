'use client'
import { useMemo, useState } from 'react'
import type { BatchResult } from '@/server/actions/inventory'
import type { GridRow, VariantOption } from './types'
import { useGridKeyboardNav } from './useGridKeyboardNav'
import { VariantSearchCell } from './VariantSearchCell'
import { QuantityStepper } from './QuantityStepper'
import { useIsWide } from '@/lib/useMediaQuery'

let seq = 0
const newRow = (): GridRow => ({ key: `row-${++seq}`, variant: null, counted: '' })

export function validateRow(row: GridRow, allRows: GridRow[]): string | undefined {
  if (!row.variant) return 'Seleccioná un producto/variante'
  const n = Number(row.counted)
  if (row.counted.trim() === '' || !Number.isInteger(n) || n < 0) return 'Cantidad inválida'
  const idx = allRows.findIndex((r) => r.variant?.variantId === row.variant!.variantId)
  const self = allRows.findIndex((r) => r.key === row.key)
  if (idx !== -1 && idx < self) return `Ya está en la fila ${idx + 1}`
  return undefined
}

export function FastEntryGrid({
  onSubmit, initialRows, mode,
}: {
  onSubmit: (payload: { variantId: string; counted: number }[]) => Promise<BatchResult>
  initialRows?: GridRow[]
  mode?: 'table' | 'card'
}) {
  const wide = useIsWide()
  const view = mode ?? (wide ? 'table' : 'card')

  const [rows, setRows] = useState<GridRow[]>(initialRows ?? [newRow()])
  const [summary, setSummary] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const validated = useMemo(() => rows.map((r) => ({ ...r, error: validateRow(r, rows) })), [rows])

  const addRow = () => setRows((rs) => [...rs, newRow()])
  const deleteRow = (i: number) => setRows((rs) => (rs.length > 1 ? rs.filter((_, x) => x !== i) : rs))
  const setVariant = (i: number, v: VariantOption) =>
    setRows((rs) => rs.map((r, x) => (x === i ? { ...r, variant: v } : r)))
  const setCounted = (i: number, val: string) =>
    setRows((rs) => rs.map((r, x) => (x === i ? { ...r, counted: val } : r)))

  const onKeyDown = useGridKeyboardNav({ onAddRow: addRow, onDeleteRow: deleteRow })

  async function save() {
    const payload = validated.filter((r) => !r.error).map((r) => ({
      variantId: r.variant!.variantId, counted: Number(r.counted),
    }))
    if (payload.length === 0) { setSummary('No hay filas válidas para guardar'); return }
    setSaving(true)
    const res = await onSubmit(payload)
    setSaving(false)
    const failedLocal = validated.length - payload.length
    setSummary(`${res.saved} guardadas, ${res.failed + failedLocal} con error`)
    const savedIds = new Set(res.results.filter((r) => r.ok).map((r) => r.variantId))
    setRows((rs) => {
      const kept = rs.filter((r) => !(r.variant && savedIds.has(r.variant.variantId)))
      return kept.length ? kept : [newRow()]
    })
  }

  return (
    <div className="pb-24">{/* deja lugar para la barra fija */}
      {view === 'table' ? (
        <table className="w-full text-sm border border-border rounded">
          <thead className="bg-card">
            <tr>
              <th className="text-left p-2 w-2/3">Producto / Variante</th>
              <th className="text-right p-2">Cantidad contada</th>
              <th className="p-2 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {validated.map((row, i) => (
              <tr key={row.key} className={row.error ? 'bg-danger/10' : undefined}>
                <td className="p-2 align-top">
                  <VariantSearchCell rowIndex={i} value={row.variant}
                    onSelect={(o) => setVariant(i, o)} onKeyDown={onKeyDown} />
                  {row.error && <p className="text-xs text-danger mt-1">{row.error}</p>}
                </td>
                <td className="p-2 align-top text-right">
                  <QuantityStepper value={row.counted} onChange={(v) => setCounted(i, v)}
                    ariaLabel={`Cantidad (fila ${i + 1})`}
                    inputProps={{
                      'data-cell': `${i}:counted`,
                      onKeyDown: (e) => onKeyDown(e, i, 'counted'),
                    } as React.InputHTMLAttributes<HTMLInputElement>} />
                </td>
                <td className="p-2 text-center align-top">
                  <button type="button" aria-label={`Eliminar fila ${i + 1}`} onClick={() => deleteRow(i)}
                    className="min-h-11 min-w-11 text-muted hover:text-danger">×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <ul className="space-y-3">
          {validated.map((row, i) => (
            <li key={row.key}
              className={`border rounded-lg p-3 ${row.error ? 'border-danger bg-danger/10' : 'border-border bg-card'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <VariantSearchCell rowIndex={i} value={row.variant}
                    onSelect={(o) => setVariant(i, o)} onKeyDown={onKeyDown} />
                </div>
                <button type="button" aria-label={`Eliminar ítem ${i + 1}`} onClick={() => deleteRow(i)}
                  className="min-h-11 min-w-11 text-muted hover:text-danger">×</button>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm text-muted">Cantidad contada</span>
                <QuantityStepper value={row.counted} onChange={(v) => setCounted(i, v)}
                  ariaLabel={`Cantidad (ítem ${i + 1})`} />
              </div>
              {row.error && <p className="text-xs text-danger mt-2">{row.error}</p>}
            </li>
          ))}
        </ul>
      )}

      <button type="button" onClick={addRow} className="mt-3 text-sm underline w-full md:w-auto min-h-11">
        {view === 'card' ? 'Agregar ítem' : '+ Agregar fila'}
      </button>

      {/* Barra de acción fija abajo */}
      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background p-3 flex items-center gap-3 z-30 lg:pl-60"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        <button type="button" onClick={save} disabled={saving}
          className="bg-primary text-primary-foreground rounded px-4 min-h-11 text-sm disabled:opacity-60">
          {saving ? 'Guardando…' : 'Guardar lote'}
        </button>
        {summary && <p className="text-sm">{summary}</p>}
      </div>
    </div>
  )
}
