'use client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export type VariantRow = {
  medida: string
  tela: string
  color: string
  cost: string
  price: string
  sku: string
}

export const emptyVariantRow: VariantRow = { medida: '', tela: '', color: '', cost: '', price: '', sku: '' }

/**
 * Controlled list of new-variant rows (used while creating a product, before
 * any of them has an id). Props: `value` (the current rows) / `onChange`
 * (replacement array) — mirrors a plain controlled-input pattern.
 */
export function VariantRows({
  value,
  onChange,
}: {
  value: VariantRow[]
  onChange: (rows: VariantRow[]) => void
}) {
  function updateRow(index: number, field: keyof VariantRow, fieldValue: string) {
    onChange(value.map((row, i) => (i === index ? { ...row, [field]: fieldValue } : row)))
  }

  function addRow() {
    onChange([...value, { ...emptyVariantRow }])
  }

  function removeRow(index: number) {
    onChange(value.filter((_, i) => i !== index))
  }

  return (
    <div className="flex flex-col gap-3">
      {value.map((row, i) => {
        const n = i + 1
        return (
          <div
            key={i}
            className="grid grid-cols-1 gap-2 rounded border border-border p-3 md:grid-cols-6 md:gap-3 md:border-0 md:p-0"
          >
            <label className="flex flex-col gap-1">
              <span className="text-sm">Medida</span>
              <Input
                aria-label={`Medida (fila ${n})`}
                value={row.medida}
                onChange={(e) => updateRow(i, 'medida', e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm">Tela</span>
              <Input
                aria-label={`Tela (fila ${n})`}
                value={row.tela}
                onChange={(e) => updateRow(i, 'tela', e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm">Color</span>
              <Input
                aria-label={`Color (fila ${n})`}
                value={row.color}
                onChange={(e) => updateRow(i, 'color', e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm">Costo</span>
              <Input
                aria-label={`Costo (fila ${n})`}
                inputMode="numeric"
                value={row.cost}
                onChange={(e) => updateRow(i, 'cost', e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm">Precio</span>
              <Input
                aria-label={`Precio (fila ${n})`}
                inputMode="numeric"
                value={row.price}
                onChange={(e) => updateRow(i, 'price', e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm">SKU</span>
              <Input
                aria-label={`SKU (fila ${n})`}
                value={row.sku}
                onChange={(e) => updateRow(i, 'sku', e.target.value)}
              />
            </label>
            <div className="md:col-span-6">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-11 w-full md:w-auto"
                onClick={() => removeRow(i)}
              >
                Quitar fila {n}
              </Button>
            </div>
          </div>
        )
      })}
      <Button type="button" variant="ghost" className="w-full md:w-auto" onClick={addRow}>
        Agregar variante
      </Button>
    </div>
  )
}
