'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSale, searchSellableVariantsAction } from '@/server/actions/sales'
import { findCustomerByPhoneAction } from '@/server/actions/customers'
import type { SellableVariant } from '@/server/queries/sales'
import { normalizePhone } from '@/lib/phone'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { QuantityStepper } from '@/components/grid/QuantityStepper'
import { money } from '@/lib/format'
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from '@/lib/constants'
import { QuoteReceipt } from './QuoteReceipt'

type CartLine = {
  variantId: string; productName: string; variantName: string
  unitPrice: number | null; available: number; quantity: string
}

export function SaleCart() {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<SellableVariant[]>([])
  const [cart, setCart] = useState<CartLine[]>([])
  const [paymentMethod, setPaymentMethod] = useState('EFECTIVO')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [foundCustomer, setFoundCustomer] = useState<{ id: string; name: string; phone: string } | null>(null)
  const [mode, setMode] = useState<'venta' | 'presupuesto'>('venta')
  const [showQuote, setShowQuote] = useState(false)

  async function handleSearch(value: string) {
    setQ(value)
    if (value.trim().length < 2) { setResults([]); return }
    setResults(await searchSellableVariantsAction(value))
  }

  async function handlePhoneChange(value: string) {
    setCustomerPhone(value)
    setCustomerName('')
    const digits = normalizePhone(value)
    if (digits.length < 6) { setFoundCustomer(null); return }
    setFoundCustomer(await findCustomerByPhoneAction(value))
  }

  function addToCart(v: SellableVariant) {
    setCart((cur) => {
      const existing = cur.find((l) => l.variantId === v.variantId)
      if (existing) {
        return cur.map((l) => (l.variantId === v.variantId ? { ...l, quantity: String(Number(l.quantity) + 1) } : l))
      }
      return [...cur, {
        variantId: v.variantId, productName: v.productName, variantName: v.variantName,
        unitPrice: v.unitPrice, available: v.quantity, quantity: '1',
      }]
    })
    setQ('')
    setResults([])
  }

  function updateQuantity(variantId: string, value: string) {
    setCart((cur) => cur.map((l) => (l.variantId === variantId ? { ...l, quantity: value } : l)))
  }

  function removeLine(variantId: string) {
    setCart((cur) => cur.filter((l) => l.variantId !== variantId))
  }

  const total = cart.reduce((sum, l) => sum + (l.unitPrice ?? 0) * (Number(l.quantity) || 0), 0)
  const unpricedLine = cart.find((l) => l.unitPrice === null)

  const phoneDigits = normalizePhone(customerPhone)
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

  async function handleConfirm() {
    setError(null)
    setPending(true)
    const items = cart.map((l) => ({ variantId: l.variantId, quantity: Number(l.quantity) || 0 }))
    const res = await createSale({
      items, paymentMethod,
      ...(customerPhone.trim() ? { customerPhone, customerName } : {}),
    })
    setPending(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    router.push(`/ventas/${res.saleId}?justCreated=1`)
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="flex gap-2 print:hidden" role="group" aria-label="Tipo">
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

      {showQuote ? (
        <QuoteReceipt
          lines={cart}
          total={total}
          customerName={quoteCustomerName}
          onNuevoPresupuesto={handleNuevoPresupuesto}
        />
      ) : (
        <>
          <div className="relative">
            <label className="flex flex-col gap-1">
              <span className="text-sm">Buscar producto</span>
              <Input aria-label="Buscar producto" placeholder="Nombre del producto o variante…" value={q}
                onChange={(e) => handleSearch(e.target.value)} />
            </label>
            {results.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full max-h-64 overflow-auto bg-card border border-border rounded shadow-lg">
                {results.map((v) => (
                  <li key={v.variantId}>
                    <button type="button" onClick={() => addToCart(v)}
                      className="flex w-full items-center justify-between gap-2 px-3 min-h-11 text-left text-sm hover:bg-border/40">
                      <span>{v.productName} · {v.variantName}</span>
                      <span className="text-muted text-xs">Quedan {v.quantity}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <ul className="flex flex-col gap-2">
            {cart.map((line) => (
              <li key={line.variantId} className="flex items-center gap-3 border border-border rounded-lg p-3">
                <div className="flex-1">
                  <p className="text-sm font-medium">{line.productName} · {line.variantName}</p>
                  <p className="text-xs text-muted">{money(line.unitPrice)} c/u · quedan {line.available}</p>
                </div>
                <QuantityStepper value={line.quantity} onChange={(v) => updateQuantity(line.variantId, v)}
                  ariaLabel={`Cantidad (${line.productName} · ${line.variantName})`} />
                <button type="button" aria-label={`Quitar ${line.productName} · ${line.variantName}`}
                  onClick={() => removeLine(line.variantId)} className="min-h-11 min-w-11 text-muted hover:text-danger">×</button>
              </li>
            ))}
            {cart.length === 0 && <li className="text-center text-muted py-4">Todavía no agregaste productos</li>}
          </ul>

          <div className="flex items-center justify-between border-t border-border pt-3">
            <span className="font-medium">Total</span>
            <span className="text-lg font-semibold">{money(total)}</span>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-sm">Teléfono del cliente (opcional)</span>
            <Input aria-label="Teléfono del cliente (opcional)" inputMode="tel" value={customerPhone}
              onChange={(e) => handlePhoneChange(e.target.value)} />
          </label>

          {phoneDigits.length >= 6 && (
            matchedCustomer ? (
              <p className="text-sm text-muted">Cliente: <strong>{matchedCustomer.name}</strong></p>
            ) : (
              <label className="flex flex-col gap-1">
                <span className="text-sm">Nombre del cliente</span>
                <Input aria-label="Nombre del cliente" value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)} />
              </label>
            )
          )}

          {mode === 'venta' && (
            <label className="flex flex-col gap-1">
              <span className="text-sm">Método de pago</span>
              <Select aria-label="Método de pago" value={paymentMethod} onValueChange={setPaymentMethod}
                options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))} />
            </label>
          )}

          {mode === 'presupuesto' && unpricedLine && (
            <p className="text-sm text-danger">
              {unpricedLine.productName} · {unpricedLine.variantName} no tiene precio cargado — no se puede generar el presupuesto.
            </p>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          <Button
            onClick={mode === 'venta' ? handleConfirm : () => setShowQuote(true)}
            loading={pending}
            disabled={cart.length === 0 || (mode === 'presupuesto' && !!unpricedLine)}
          >
            {mode === 'venta' ? (pending ? 'Guardando…' : 'Confirmar venta') : 'Generar presupuesto'}
          </Button>
        </>
      )}
    </div>
  )
}
