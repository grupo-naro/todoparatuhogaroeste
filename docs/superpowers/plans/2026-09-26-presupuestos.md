# Presupuestos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar un modo "Presupuesto" a la pantalla `/ventas/nueva` existente que arma el mismo carrito de productos pero, al confirmar, imprime una cotización sin tocar stock ni guardar nada en la base de datos.

**Architecture:** `SaleCart` gana un toggle de modo (Venta/Presupuesto) puramente en estado de componente. En modo Presupuesto, el botón de confirmar no llama a ningún Server Action — simplemente reemplaza el carrito por un nuevo componente presentacional (`QuoteReceipt`) que recibe las líneas ya armadas por props y dispara la impresión del navegador al montarse.

**Tech Stack:** Next.js 16 (Client Component, sin Server Actions nuevas), Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-25-presupuestos-design.md`

## Global Constraints

- Sin cambios de schema/Prisma, sin Server Action nueva, sin ruta nueva — todo el trabajo son 2 componentes de UI.
- El precio de cada línea es siempre el ya cargado en el producto — nunca editable, mismo criterio que una venta.
- El modo Presupuesto **nunca** crea ni vincula un `Customer`, aunque se haya cargado teléfono/nombre — esos campos son solo para lo que se imprime.
- `jsdom` no implementa `window.print` — todo test que renderice `QuoteReceipt` (directo o a través de `SaleCart`) necesita `vi.spyOn(window, 'print').mockImplementation(() => {})` antes de renderizar, si no la salida de test queda con un "Not implemented" ruidoso.
- Ninguno de los 8 tests que ya existen en `SaleCart.test.tsx` puede dejar de pasar — todos buscan el botón por el nombre `'Confirmar venta'`, que solo existe cuando el modo por default (`'venta'`) sigue siendo el default.
- Cada commit termina con: `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

## Review Focus

- El modo Presupuesto no debe, bajo ningún camino, invocar `createSale` — es la garantía central de que no se descuenta stock ni se persiste nada. Test dedicado en Task 2 con `expect(createSale).not.toHaveBeenCalled()`.
- El nombre del cliente en el presupuesto impreso debe quedar `undefined` (sin mostrar la línea) si se cargó teléfono pero todavía no se completó el nombre — no una cadena vacía. Cubierto en Task 2.
- Cambiar de modo no debe vaciar el carrito ni los datos de cliente ya cargados. Cubierto en Task 2.
- `QuoteReceipt` no debe mostrar nada de vendedora ni método de pago — un presupuesto no tiene ninguno de los dos todavía. Cubierto en Task 1.
- El total y los subtotales de una única línea pueden coincidir en un mismo valor (ej. 1 unidad) — los tests que buscan un monto por texto exacto anclado (`/^\$\s*N,00$/`) tienen que elegir cantidades/precios donde el total de la venta completa y el subtotal de una línea individual no coincidan, para no toparse con "Found multiple elements". Cubierto en Task 1 (se explica en el propio test).

---

### Task 1: `QuoteReceipt` — vista imprimible del presupuesto

**Files:**
- Create: `src/components/ventas/QuoteReceipt.tsx`
- Test: `src/components/ventas/QuoteReceipt.test.tsx`

**Interfaces:**
- Consumes: `money`, `integer` (`@/lib/format`, ya existen); `Button` (`@/components/ui/button`, ya existe).
- Produces: `<QuoteReceipt lines={QuoteLine[]} total={number} customerName={string | undefined} onNuevoPresupuesto={() => void} />`, con `type QuoteLine = { variantId: string; productName: string; variantName: string; unitPrice: number | null; quantity: string }`.

- [ ] **Step 1: Test que falla — `src/components/ventas/QuoteReceipt.test.tsx`**

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuoteReceipt } from './QuoteReceipt'

// unitPrice 300 × cantidad 2 = subtotal 600, distinto del unitPrice (300) —
// evita que el total ($ 600,00) matchee por accidente la celda de precio
// unitario al buscar por texto exacto anclado.
const lines = [
  { variantId: 'v1', productName: 'Sillón Milán', variantName: '2 cuerpos', unitPrice: 300, quantity: '2' },
]

describe('QuoteReceipt', () => {
  it('muestra las líneas, cantidades y el total', () => {
    vi.spyOn(window, 'print').mockImplementation(() => {})
    render(<QuoteReceipt lines={lines} total={600} onNuevoPresupuesto={vi.fn()} />)
    expect(screen.getByText(/Sillón Milán/)).toBeInTheDocument()
    expect(screen.getByText(/^\$\s*600,00$/)).toBeInTheDocument()
  })

  it('muestra "Presupuesto para" solo si se pasa customerName', () => {
    vi.spyOn(window, 'print').mockImplementation(() => {})
    const { rerender } = render(<QuoteReceipt lines={lines} total={600} onNuevoPresupuesto={vi.fn()} />)
    expect(screen.queryByText(/Presupuesto para/)).not.toBeInTheDocument()
    rerender(<QuoteReceipt lines={lines} total={600} customerName="Ana Gómez" onNuevoPresupuesto={vi.fn()} />)
    expect(screen.getByText(/Presupuesto para/)).toBeInTheDocument()
    expect(screen.getByText('Ana Gómez')).toBeInTheDocument()
  })

  it('no muestra vendedora ni método de pago', () => {
    vi.spyOn(window, 'print').mockImplementation(() => {})
    render(<QuoteReceipt lines={lines} total={600} onNuevoPresupuesto={vi.fn()} />)
    expect(screen.queryByText(/Vendedora/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Método de pago/)).not.toBeInTheDocument()
  })

  it('muestra el texto fijo del pie', () => {
    vi.spyOn(window, 'print').mockImplementation(() => {})
    render(<QuoteReceipt lines={lines} total={600} onNuevoPresupuesto={vi.fn()} />)
    expect(screen.getByText(/Presupuesto sin cargo/)).toBeInTheDocument()
  })

  it('llama a window.print() al montarse', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {})
    render(<QuoteReceipt lines={lines} total={600} onNuevoPresupuesto={vi.fn()} />)
    expect(printSpy).toHaveBeenCalledTimes(1)
  })

  it('el botón "Nuevo presupuesto" llama a onNuevoPresupuesto', async () => {
    vi.spyOn(window, 'print').mockImplementation(() => {})
    const onNuevo = vi.fn()
    render(<QuoteReceipt lines={lines} total={600} onNuevoPresupuesto={onNuevo} />)
    await userEvent.click(screen.getByRole('button', { name: 'Nuevo presupuesto' }))
    expect(onNuevo).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Ejecutar — debe fallar.** Run: `pnpm test src/components/ventas/QuoteReceipt.test.tsx` → FAIL (`QuoteReceipt.tsx` no existe).

- [ ] **Step 3: Implementar `src/components/ventas/QuoteReceipt.tsx`**

```tsx
'use client'
import { useEffect } from 'react'
import Image from 'next/image'
import { money, integer } from '@/lib/format'
import { Button } from '@/components/ui/button'

export type QuoteLine = {
  variantId: string; productName: string; variantName: string
  unitPrice: number | null; quantity: string
}

export function QuoteReceipt({ lines, total, customerName, onNuevoPresupuesto }: {
  lines: QuoteLine[]; total: number; customerName?: string; onNuevoPresupuesto: () => void
}) {
  useEffect(() => {
    window.print()
  }, [])

  return (
    <section className="max-w-lg mx-auto print:max-w-none">
      <div className="flex items-center justify-between mb-4 print:hidden">
        <h1 className="text-xl font-semibold">Presupuesto</h1>
        <div className="flex gap-2">
          <button type="button" onClick={() => window.print()}
            className="min-h-11 px-3 rounded border border-border text-sm">Imprimir</button>
          <Button onClick={onNuevoPresupuesto}>Nuevo presupuesto</Button>
        </div>
      </div>

      <div className="border border-border rounded-lg p-4 print:border-0 print:p-0">
        <div className="flex items-center gap-3 mb-3">
          <Image src="/logo.png" alt="" width={40} height={40} className="rounded-full" />
          <div>
            <p className="font-semibold">Jael Castillo — Todo para tu Hogar</p>
            <p className="text-xs text-muted">Presupuesto</p>
          </div>
        </div>
        {customerName && <p className="text-sm mb-3">Presupuesto para: <strong>{customerName}</strong></p>}

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="py-1">Producto</th>
              <th className="py-1 text-right">Cant.</th>
              <th className="py-1 text-right">P. unit.</th>
              <th className="py-1 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.variantId} className="border-b border-border">
                <td className="py-1">{line.productName} · {line.variantName}</td>
                <td className="py-1 text-right">{integer(Number(line.quantity) || 0)}</td>
                <td className="py-1 text-right">{money(line.unitPrice)}</td>
                <td className="py-1 text-right">{money((line.unitPrice ?? 0) * (Number(line.quantity) || 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="text-right font-semibold mt-2">Total: {money(total)}</p>

        <p className="text-xs text-muted mt-4 text-center">
          Presupuesto sin cargo. Precios y stock sujetos a confirmación al momento de la compra.
        </p>
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Ejecutar — debe pasar.** Run: `pnpm test src/components/ventas/QuoteReceipt.test.tsx` → PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ventas/QuoteReceipt.tsx src/components/ventas/QuoteReceipt.test.tsx
git commit -m "feat: QuoteReceipt imprime un presupuesto sin persistir nada"
```

---

### Task 2: Modo Presupuesto en `SaleCart`

**Files:**
- Modify: `src/components/ventas/SaleCart.tsx`
- Modify: `src/components/ventas/SaleCart.test.tsx`

**Interfaces:**
- Consumes: `QuoteReceipt`, `QuoteLine` (Task 1, `./QuoteReceipt`).
- Produces: sin cambio de firma pública — `<SaleCart />` sigue sin props.

- [ ] **Step 1: Test que falla — agregar a `src/components/ventas/SaleCart.test.tsx`**

Agregar el import de `QuoteLine`... en realidad no hace falta importar el tipo en el test. Agregar, al final del archivo, un nuevo `describe`:

```tsx
describe('SaleCart — modo presupuesto', () => {
  it('el toggle cambia el texto del botón y oculta el método de pago', async () => {
    render(<SaleCart />)
    expect(screen.getByRole('button', { name: 'Confirmar venta' })).toBeInTheDocument()
    expect(screen.getByLabelText('Método de pago')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Presupuesto' }))
    expect(screen.getByRole('button', { name: 'Generar presupuesto' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Método de pago')).not.toBeInTheDocument()
  })

  it('generar un presupuesto muestra el contenido esperado y no llama a createSale', async () => {
    vi.spyOn(window, 'print').mockImplementation(() => {})
    searchSellableVariantsAction.mockResolvedValue([variant])
    render(<SaleCart />)
    await userEvent.click(screen.getByRole('button', { name: 'Presupuesto' }))
    await userEvent.type(screen.getByLabelText('Buscar producto'), 'milán')
    await userEvent.click(await findResultButton())
    await userEvent.click(screen.getByRole('button', { name: 'Generar presupuesto' }))

    expect(screen.getByRole('heading', { name: 'Presupuesto' })).toBeInTheDocument()
    expect(screen.getByText(/Sillón Milán/)).toBeInTheDocument()
    expect(createSale).not.toHaveBeenCalled()
  })

  it('cambiar de modo con el carrito cargado no lo vacía', async () => {
    searchSellableVariantsAction.mockResolvedValue([variant])
    render(<SaleCart />)
    await userEvent.type(screen.getByLabelText('Buscar producto'), 'milán')
    await userEvent.click(await findResultButton())
    await userEvent.click(screen.getByRole('button', { name: 'Presupuesto' }))
    expect(screen.getByLabelText(/^Cantidad \(/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Venta' }))
    expect(screen.getByLabelText(/^Cantidad \(/)).toBeInTheDocument()
  })

  it('"Nuevo presupuesto" vacía el carrito y vuelve a la pantalla de armado', async () => {
    vi.spyOn(window, 'print').mockImplementation(() => {})
    searchSellableVariantsAction.mockResolvedValue([variant])
    render(<SaleCart />)
    await userEvent.click(screen.getByRole('button', { name: 'Presupuesto' }))
    await userEvent.type(screen.getByLabelText('Buscar producto'), 'milán')
    await userEvent.click(await findResultButton())
    await userEvent.click(screen.getByRole('button', { name: 'Generar presupuesto' }))
    await userEvent.click(screen.getByRole('button', { name: 'Nuevo presupuesto' }))

    expect(screen.getByRole('button', { name: 'Generar presupuesto' })).toBeInTheDocument()
    expect(screen.queryByLabelText(/^Cantidad \(/)).not.toBeInTheDocument()
  })

  it('teléfono cargado sin nombre todavía no muestra "Presupuesto para" en el impreso', async () => {
    vi.spyOn(window, 'print').mockImplementation(() => {})
    searchSellableVariantsAction.mockResolvedValue([variant])
    findCustomerByPhoneAction.mockResolvedValue(null)
    render(<SaleCart />)
    await userEvent.click(screen.getByRole('button', { name: 'Presupuesto' }))
    await userEvent.type(screen.getByLabelText('Buscar producto'), 'milán')
    await userEvent.click(await findResultButton())
    await userEvent.type(screen.getByLabelText('Teléfono del cliente (opcional)'), '1123456789')
    await screen.findByLabelText('Nombre del cliente') // confirma que ya cargó, sin escribir nada
    await userEvent.click(screen.getByRole('button', { name: 'Generar presupuesto' }))
    expect(screen.queryByText(/Presupuesto para/)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Ejecutar — debe fallar.** Run: `pnpm test src/components/ventas/SaleCart.test.tsx` → FAIL (el toggle no existe todavía; los 8 tests existentes siguen pasando).

- [ ] **Step 3: Implementar en `src/components/ventas/SaleCart.tsx`**

Agregar el import junto a los demás:

```ts
import { QuoteReceipt } from './QuoteReceipt'
```

Agregar estado nuevo, junto a los `useState` existentes (después de `foundCustomer`):

```ts
  const [mode, setMode] = useState<'venta' | 'presupuesto'>('venta')
  const [showQuote, setShowQuote] = useState(false)
```

Cambiar (justo después de la línea `const matchedCustomer = foundCustomer?.phone === phoneDigits ? foundCustomer : null`):

```ts
  const matchedCustomer = foundCustomer?.phone === phoneDigits ? foundCustomer : null
```

a:

```ts
  const matchedCustomer = foundCustomer?.phone === phoneDigits ? foundCustomer : null
  const quoteCustomerName = matchedCustomer?.name || customerName.trim() || undefined

  function handleModeChange(next: 'venta' | 'presupuesto') {
    setMode(next)
    setShowQuote(false)
  }

  function handleNuevoPresupuesto() {
    setCart([])
    setCustomerPhone('')
    setCustomerName('')
    setFoundCustomer(null)
    setShowQuote(false)
  }
```

Cambiar el inicio del `return` de:

```tsx
  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="relative">
```

a:

```tsx
  if (showQuote) {
    return (
      <QuoteReceipt
        lines={cart}
        total={total}
        customerName={quoteCustomerName}
        onNuevoPresupuesto={handleNuevoPresupuesto}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="flex gap-2" role="group" aria-label="Tipo">
        <button type="button" aria-pressed={mode === 'venta'} onClick={() => handleModeChange('venta')}
          className={`px-3 min-h-11 rounded text-sm font-medium ${
            mode === 'venta' ? 'bg-primary text-primary-foreground' : 'border border-border'
          }`}>
          Venta
        </button>
        <button type="button" aria-pressed={mode === 'presupuesto'} onClick={() => handleModeChange('presupuesto')}
          className={`px-3 min-h-11 rounded text-sm font-medium ${
            mode === 'presupuesto' ? 'bg-primary text-primary-foreground' : 'border border-border'
          }`}>
          Presupuesto
        </button>
      </div>

      <div className="relative">
```

Cambiar:

```tsx
      <label className="flex flex-col gap-1">
        <span className="text-sm">Método de pago</span>
        <Select aria-label="Método de pago" value={paymentMethod} onValueChange={setPaymentMethod}
          options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))} />
      </label>

      {error && <p className="text-sm text-danger">{error}</p>}

      <Button onClick={handleConfirm} disabled={pending || cart.length === 0}>
        {pending ? 'Guardando…' : 'Confirmar venta'}
      </Button>
    </div>
  )
}
```

a:

```tsx
      {mode === 'venta' && (
        <label className="flex flex-col gap-1">
          <span className="text-sm">Método de pago</span>
          <Select aria-label="Método de pago" value={paymentMethod} onValueChange={setPaymentMethod}
            options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))} />
        </label>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      <Button
        onClick={mode === 'venta' ? handleConfirm : () => setShowQuote(true)}
        disabled={pending || cart.length === 0}
      >
        {mode === 'venta' ? (pending ? 'Guardando…' : 'Confirmar venta') : 'Generar presupuesto'}
      </Button>
    </div>
  )
}
```

- [ ] **Step 4: Ejecutar — debe pasar.** Run: `pnpm test src/components/ventas/SaleCart.test.tsx` → PASS (todo el archivo — 8 tests existentes + 5 nuevos = 13).

- [ ] **Step 5: Verificar la suite completa y el build**

```bash
pnpm test
pnpm exec tsc --noEmit
pnpm exec eslint .
pnpm build
```

- [ ] **Step 6: Commit**

```bash
git add src/components/ventas/SaleCart.tsx src/components/ventas/SaleCart.test.tsx
git commit -m "feat: modo Presupuesto en SaleCart (arma el mismo carrito, imprime sin persistir)"
```
