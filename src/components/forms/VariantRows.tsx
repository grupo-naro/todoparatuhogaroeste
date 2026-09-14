'use client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { QuantityStepper } from '@/components/grid/QuantityStepper'

export type VariantRow = {
  medida: string
  tela: string
  color: string
  cost: string
  price: string
  sku: string
  stockInicial: string
}

export const emptyVariantRow: VariantRow = {
  medida: '', tela: '', color: '', cost: '', price: '', sku: '', stockInicial: '',
}

/**
 * Controlled list of new-variant rows (used while creating a product, before
 * any of them has an id). Props: `value` (the current rows) / `onChange`
 * (replacement array) — mirrors a plain controlled-input pattern.
 */
export function VariantRows({
  value,
  onChange,
  defaultCost,
  defaultPrice,
}: {
  value: VariantRow[]
  onChange: (rows: VariantRow[]) => void
  defaultCost?: string
  defaultPrice?: string
}) {
  function updateRow(index: number, field: keyof VariantRow, fieldValue: string) {
    onChange(value.map((row, i) => (i === index ? { ...row, [field]: fieldValue } : row)))
  }

  function addRow() {
    const last = value[value.length - 1]
    // El SKU es único por variante y el stock inicial suele variar fila a
    // fila — ninguno de los dos se copia, para no forzar un choque de SKU ni
    // una cantidad de estante equivocada si el usuario olvida cambiarla.
    const next: VariantRow = last
      ? { ...last, sku: '', stockInicial: '' }
      : { ...emptyVariantRow, cost: defaultCost ?? '', price: defaultPrice ?? '' }
    onChange([...value, next])
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
            className="grid grid-cols-1 gap-2 rounded border border-border p-3 lg:grid-cols-7 lg:gap-3 lg:border-0 lg:p-0"
          >
            <label className="flex flex-col gap-1">
              <span className="text-sm">Medida</span>
              <Input
                aria-label={`Medida (fila ${n})`}
                value={row.medida}
                onFocus={(e) => e.target.select()}
                onChange={(e) => updateRow(i, 'medida', e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm">Tela</span>
              <Input
                aria-label={`Tela (fila ${n})`}
                value={row.tela}
                onFocus={(e) => e.target.select()}
                onChange={(e) => updateRow(i, 'tela', e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm">Color</span>
              <Input
                aria-label={`Color (fila ${n})`}
                value={row.color}
                onFocus={(e) => e.target.select()}
                onChange={(e) => updateRow(i, 'color', e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm">Costo</span>
              <Input
                aria-label={`Costo (fila ${n})`}
                inputMode="numeric"
                value={row.cost}
                onFocus={(e) => e.target.select()}
                onChange={(e) => updateRow(i, 'cost', e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm">Precio</span>
              <Input
                aria-label={`Precio (fila ${n})`}
                inputMode="numeric"
                value={row.price}
                onFocus={(e) => e.target.select()}
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
            <label className="flex flex-col gap-1">
              <span className="text-sm">Stock inicial</span>
              <QuantityStepper
                ariaLabel={`Stock inicial (fila ${n})`}
                value={row.stockInicial}
                onChange={(v) => updateRow(i, 'stockInicial', v)}
              />
            </label>
            <div className="lg:col-span-7">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full md:w-auto"
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
