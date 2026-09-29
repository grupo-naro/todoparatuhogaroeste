'use client'
import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createProduct, updateProduct, deleteProduct } from '@/server/actions/products'
import { createVariant, updateVariant, deleteVariant } from '@/server/actions/variants'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { QuantityStepper } from '@/components/grid/QuantityStepper'
import { ProductImageGallery } from '@/components/products/ProductImageGallery'
import { VariantRows, emptyVariantRow, type VariantRow } from './VariantRows'

// Local types instead of importing `@/server/queries/products` /
// `@/server/queries/categories` — both pull in `server-only`, and this file
// (and VariantRows) run as Client Components.
export type CategoryOption = { value: string; label: string }
export type ProductDetail = {
  id: string
  name: string
  categoryId: string
  description: string | null
  defaultCost: number | string | null
  defaultPrice: number | string | null
  variants: Array<{
    id: string
    name: string
    medida: string | null
    tela: string | null
    color: string | null
    cost: number | string | null
    price: number | string | null
    sku: string | null
    isDefault: boolean
    stock: { quantity: number } | null
  }>
  images: Array<{ id: string; url: string; order: number }>
}

type Props =
  | { mode: 'create'; categories: CategoryOption[] }
  | { mode: 'edit'; product: ProductDetail; categories: CategoryOption[] }

function toStr(v: number | string | null | undefined): string {
  return v === null || v === undefined ? '' : String(v)
}

// Prellena "Agregar variante" con los datos de la última variante existente
// (medida/tela/color/costo/precio suelen repetirse; el SKU no, es único por
// variante). Sin variantes todavía, arranca del costo/precio del producto.
function initialAddVariantRow(product: ProductDetail): VariantRow {
  const last = product.variants[product.variants.length - 1]
  if (!last) return { ...emptyVariantRow, cost: toStr(product.defaultCost), price: toStr(product.defaultPrice) }
  return {
    medida: last.medida ?? '', tela: last.tela ?? '', color: last.color ?? '',
    cost: toStr(last.cost), price: toStr(last.price), sku: '', stockInicial: '',
  }
}

export function ProductForm(props: Props) {
  const router = useRouter()
  const product = props.mode === 'edit' ? props.product : null

  const [name, setName] = useState(product?.name ?? '')
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? '')
  const [description, setDescription] = useState(product?.description ?? '')
  const [defaultCost, setDefaultCost] = useState(toStr(product?.defaultCost))
  const [defaultPrice, setDefaultPrice] = useState(toStr(product?.defaultPrice))
  const [variants, setVariants] = useState<VariantRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const base = {
      name,
      categoryId,
      description: description.trim() ? description.trim() : null,
      defaultCost: defaultCost === '' ? null : defaultCost,
      defaultPrice: defaultPrice === '' ? null : defaultPrice,
    }
    if (props.mode === 'create') {
      const res = await createProduct({ ...base, variants })
      setSaving(false)
      if (res.ok) router.push('/productos')
      else setError(res.error)
    } else {
      const res = await updateProduct(props.product.id, base)
      setSaving(false)
      if (!res.ok) setError(res.error)
    }
  }

  async function handleDeleteProduct() {
    if (props.mode !== 'edit') return
    if (!window.confirm('¿Seguro que querés eliminar este producto? Esta acción no se puede deshacer.')) return
    const res = await deleteProduct(props.product.id)
    if (res.ok) router.push('/productos')
    else setError(res.error)
  }

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="text-sm">Nombre / Modelo</span>
            <Input
              aria-label="Nombre / Modelo"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="text-sm">Categoría</span>
            <select
              aria-label="Categoría"
              required
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full border border-border rounded px-3 min-h-11 text-base md:text-sm bg-transparent"
            >
              <option value="" disabled>
                Elegí una categoría
              </option>
              {props.categories.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="text-sm">Descripción</span>
            <Input
              aria-label="Descripción"
              value={description ?? ''}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm">Costo</span>
            <Input
              aria-label="Costo"
              inputMode="numeric"
              value={defaultCost}
              onChange={(e) => setDefaultCost(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm">Precio</span>
            <Input
              aria-label="Precio"
              inputMode="numeric"
              value={defaultPrice}
              onChange={(e) => setDefaultPrice(e.target.value)}
            />
          </label>
        </div>

        {props.mode === 'create' && (
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-medium">Variantes</h2>
            <VariantRows
              value={variants}
              onChange={setVariants}
              defaultCost={defaultCost}
              defaultPrice={defaultPrice}
            />
          </div>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        <Button type="submit" loading={saving} className="w-full md:w-auto">
          Guardar producto
        </Button>
      </form>

      {props.mode === 'edit' && (
        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-medium">Variantes</h2>
          <div className="flex flex-col gap-3">
            {props.product.variants.map((v) => (
              <ExistingVariantRow key={v.id} variant={v} />
            ))}
          </div>
          <AddVariantForm productId={props.product.id} initial={initialAddVariantRow(props.product)} />
        </div>
      )}

      {props.mode === 'edit' && (
        <ProductImageGallery productId={props.product.id} images={props.product.images} />
      )}

      {props.mode === 'edit' && (
        <Button variant="danger" className="w-full md:w-auto" onClick={handleDeleteProduct}>
          Eliminar producto
        </Button>
      )}
    </div>
  )
}

function ExistingVariantRow({ variant }: { variant: ProductDetail['variants'][number] }) {
  const { toast } = useToast()
  const [medida, setMedida] = useState(variant.medida ?? '')
  const [tela, setTela] = useState(variant.tela ?? '')
  const [color, setColor] = useState(variant.color ?? '')
  const [cost, setCost] = useState(toStr(variant.cost))
  const [price, setPrice] = useState(toStr(variant.price))
  const [sku, setSku] = useState(variant.sku ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    setError(null)
    const res = await updateVariant(variant.id, {
      medida: medida || null,
      tela: tela || null,
      color: color || null,
      cost: cost === '' ? null : cost,
      price: price === '' ? null : price,
      sku: sku || null,
    })
    setSaving(false)
    if (!res.ok) setError(res.error)
  }

  async function handleDelete() {
    if (!window.confirm('¿Seguro que querés eliminar esta variante? Esta acción no se puede deshacer.')) return
    const res = await deleteVariant(variant.id)
    if (!res.ok) toast(res.error, 'danger')
  }

  return (
    <div className="grid grid-cols-1 gap-2 rounded border border-border p-3 lg:grid-cols-6 lg:gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-sm">Medida</span>
        <Input
          aria-label={`Medida (${variant.name})`}
          value={medida}
          onChange={(e) => setMedida(e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm">Tela</span>
        <Input aria-label={`Tela (${variant.name})`} value={tela} onChange={(e) => setTela(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm">Color</span>
        <Input aria-label={`Color (${variant.name})`} value={color} onChange={(e) => setColor(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm">Costo</span>
        <Input
          aria-label={`Costo (${variant.name})`}
          inputMode="numeric"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm">Precio</span>
        <Input
          aria-label={`Precio (${variant.name})`}
          inputMode="numeric"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm">SKU</span>
        <Input aria-label={`SKU (${variant.name})`} value={sku} onChange={(e) => setSku(e.target.value)} />
      </label>

      <div className="flex flex-col gap-2 sm:flex-row lg:col-span-6">
        <Button type="button" size="sm" loading={saving} className="w-full md:w-auto" onClick={handleSave}>
          Guardar variante
        </Button>
        <Button
          type="button"
          variant="danger"
          size="sm"
          className="w-full md:w-auto"
          onClick={handleDelete}
        >
          Eliminar variante
        </Button>
      </div>
      {error && <p className="text-sm text-danger lg:col-span-6">{error}</p>}
      {variant.stock && (
        <p className="text-xs text-muted lg:col-span-6">Stock: {variant.stock.quantity}</p>
      )}
    </div>
  )
}

function AddVariantForm({ productId, initial }: { productId: string; initial: VariantRow }) {
  const [row, setRow] = useState<VariantRow>(initial)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function update(field: keyof VariantRow, value: string) {
    setRow((r) => ({ ...r, [field]: value }))
  }

  async function handleAdd() {
    setSaving(true)
    setError(null)
    const res = await createVariant(productId, {
      medida: row.medida || null,
      tela: row.tela || null,
      color: row.color || null,
      cost: row.cost === '' ? null : row.cost,
      price: row.price === '' ? null : row.price,
      sku: row.sku || null,
      stockInicial: row.stockInicial === '' ? null : row.stockInicial,
    })
    setSaving(false)
    if (res.ok) setRow(initial)
    else setError(res.error)
  }

  return (
    <div className="flex flex-col gap-2 rounded border border-border p-3">
      <h3 className="text-sm font-medium">Agregar variante</h3>
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-7 lg:gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm">Medida</span>
          <Input
            aria-label="Medida (nueva variante)"
            value={row.medida}
            onFocus={(e) => e.target.select()}
            onChange={(e) => update('medida', e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm">Tela</span>
          <Input
            aria-label="Tela (nueva variante)"
            value={row.tela}
            onFocus={(e) => e.target.select()}
            onChange={(e) => update('tela', e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm">Color</span>
          <Input
            aria-label="Color (nueva variante)"
            value={row.color}
            onFocus={(e) => e.target.select()}
            onChange={(e) => update('color', e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm">Costo</span>
          <Input
            aria-label="Costo (nueva variante)"
            inputMode="numeric"
            value={row.cost}
            onFocus={(e) => e.target.select()}
            onChange={(e) => update('cost', e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm">Precio</span>
          <Input
            aria-label="Precio (nueva variante)"
            inputMode="numeric"
            value={row.price}
            onFocus={(e) => e.target.select()}
            onChange={(e) => update('price', e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm">SKU</span>
          <Input aria-label="SKU (nueva variante)" value={row.sku} onChange={(e) => update('sku', e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm">Stock inicial</span>
          <QuantityStepper
            ariaLabel="Stock inicial (nueva variante)"
            value={row.stockInicial}
            onChange={(v) => update('stockInicial', v)}
          />
        </label>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button type="button" loading={saving} className="w-full md:w-auto" onClick={handleAdd}>
        Agregar variante
      </Button>
    </div>
  )
}
