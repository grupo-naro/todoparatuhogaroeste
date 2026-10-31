'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createReservation } from '@/server/actions/reservations'
import { searchSellableVariantsAction } from '@/server/actions/sales'
import { findCustomerByPhoneAction } from '@/server/actions/customers'
import type { SellableVariant } from '@/server/queries/sales'
import { normalizePhone } from '@/lib/phone'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { QuantityStepper } from '@/components/grid/QuantityStepper'
import { money } from '@/lib/format'
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from '@/lib/constants'

type CartLine = {
  variantId: string; productName: string; variantName: string
  unitPrice: number | null; available: number; quantity: string
}

export function ReservationForm() {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<SellableVariant[]>([])
  const [cart, setCart] = useState<CartLine[]>([])
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [foundCustomer, setFoundCustomer] = useState<{ id: string; name: string; phone: string } | null>(null)
  const [shippingAddress, setShippingAddress] = useState('')
  const [shippingCity, setShippingCity] = useState('')
  const [note, setNote] = useState('')
  const [deposit, setDeposit] = useState('')
  const [discount, setDiscount] = useState('')
  const [discountReason, setDiscountReason] = useState('')
  const [depositMethod, setDepositMethod] = useState('EFECTIVO')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const searchSeq = useRef(0)
  const phoneSeq = useRef(0)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const phoneTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => { clearTimeout(searchTimer.current); clearTimeout(phoneTimer.current) }, [])

  function handleSearch(value: string) {
    setQ(value)
    clearTimeout(searchTimer.current)
    const seq = ++searchSeq.current
    if (value.trim().length < 2) { setResults([]); return }
    searchTimer.current = setTimeout(async () => {
      const res = await searchSellableVariantsAction(value)
      if (seq === searchSeq.current) setResults(res)
    }, 250)
  }

  function handlePhoneChange(value: string) {
    setCustomerPhone(value)
    setCustomerName('')
    clearTimeout(phoneTimer.current)
    const seq = ++phoneSeq.current
    if (normalizePhone(value).length < 6) { setFoundCustomer(null); return }
    phoneTimer.current = setTimeout(async () => {
      const res = await findCustomerByPhoneAction(value)
      if (seq === phoneSeq.current) setFoundCustomer(res)
    }, 250)
  }

  function addToCart(v: SellableVariant) {
    setCart((cur) => {
      if (cur.some((l) => l.variantId === v.variantId)) {
        return cur.map((l) => (l.variantId === v.variantId ? { ...l, quantity: String(Number(l.quantity) + 1) } : l))
      }
      return [...cur, {
        variantId: v.variantId, productName: v.productName, variantName: v.variantName,
        unitPrice: v.unitPrice, available: v.quantity, quantity: '1',
      }]
    })
    searchSeq.current++
    setQ('')
    setResults([])
  }

  const total = cart.reduce((sum, l) => sum + (l.unitPrice ?? 0) * (Number(l.quantity) || 0), 0)
  const unpricedLine = cart.find((l) => l.unitPrice === null)
  const phoneDigits = normalizePhone(customerPhone)
  const matched = foundCustomer?.phone === phoneDigits ? foundCustomer : null
  const depositAmount = Number(deposit.replace(',', '.'))
  const discountValue = Number(discount.replace(',', '.')) || 0
  const discountTooBig = discountValue > total
  const netTotal = discountTooBig ? total : total - discountValue

  async function handleSave() {
    setError(null)
    setPending(true)
    const address = shippingAddress.trim()
    const res = await createReservation({
      items: cart.map((l) => ({ variantId: l.variantId, quantity: Number(l.quantity) || 0 })),
      ...(customerPhone.trim() ? { customerPhone, customerName: matched?.name ?? customerName } : {}),
      ...(address ? { shippingAddress: address } : {}),
      ...(shippingCity.trim() ? { shippingCity: shippingCity.trim() } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
      ...(deposit.trim() ? { deposit: { amount: depositAmount, paymentMethod: depositMethod } } : {}),
      ...(discountValue > 0 ? { discount: discountValue, ...(discountReason.trim() ? { discountReason: discountReason.trim() } : {}) } : {}),
    })
    setPending(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    router.push(`/reservas/${res.reservationId}`)
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
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
                  <span className="text-muted text-xs">{v.quantity > 0 ? `Disponibles ${v.quantity}` : 'Sin stock'}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ul className="flex flex-col gap-2">
        {cart.map((line) => {
          const qty = Number(line.quantity) || 0
          const missing = Math.max(0, qty - line.available)
          return (
            <li key={line.variantId} className="flex flex-wrap items-center gap-x-3 gap-y-2 border border-border rounded-lg p-3">
              <div className="flex-1 min-w-40">
                <p className="text-sm font-medium">{line.productName} · {line.variantName}</p>
                <p className="text-xs text-muted">{money(line.unitPrice)} c/u · disponibles {line.available}</p>
                {missing > 0 && (
                  <p className="text-xs text-danger">{missing} {missing === 1 ? 'queda' : 'quedan'} esperando stock</p>
                )}
              </div>
              <QuantityStepper value={line.quantity}
                onChange={(v) => setCart((cur) => cur.map((l) => (l.variantId === line.variantId ? { ...l, quantity: v } : l)))}
                ariaLabel={`Cantidad (${line.productName} · ${line.variantName})`} />
              <button type="button" aria-label={`Quitar ${line.productName} · ${line.variantName}`}
                onClick={() => setCart((cur) => cur.filter((l) => l.variantId !== line.variantId))}
                className="min-h-11 min-w-11 text-xl text-muted hover:text-danger active:text-danger">×</button>
            </li>
          )
        })}
        {cart.length === 0 && <li className="text-center text-muted py-4">Todavía no agregaste productos</li>}
      </ul>

      <label className="flex flex-col gap-1">
        <span className="text-sm">Teléfono de la clienta</span>
        <Input aria-label="Teléfono de la clienta" inputMode="tel" value={customerPhone}
          onChange={(e) => handlePhoneChange(e.target.value)} />
      </label>
      {phoneDigits.length >= 6 && (
        matched ? (
          <p className="text-sm text-muted">Clienta: <strong>{matched.name}</strong></p>
        ) : (
          <label className="flex flex-col gap-1">
            <span className="text-sm">Nombre de la clienta</span>
            <Input aria-label="Nombre de la clienta" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          </label>
        )
      )}

      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <label className="flex flex-col gap-1">
          <span className="text-sm">Dirección de envío (opcional)</span>
          <Input aria-label="Dirección de envío (opcional)" maxLength={200} value={shippingAddress}
            onChange={(e) => setShippingAddress(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm">Localidad (opcional)</span>
          <Input aria-label="Localidad (opcional)" maxLength={80} value={shippingCity}
            onChange={(e) => setShippingCity(e.target.value)} />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-sm">Nota (opcional)</span>
        <Input aria-label="Nota (opcional)" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm">Descuento ($) (opcional)</span>
          <Input aria-label="Descuento ($) (opcional)" inputMode="decimal" value={discount}
            onChange={(e) => setDiscount(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm">Motivo del descuento (opcional)</span>
          <Input aria-label="Motivo del descuento (opcional)" maxLength={100} placeholder="Por ejemplo: mancha mínima"
            value={discountReason} onChange={(e) => setDiscountReason(e.target.value)} />
        </label>
      </div>
      {discountTooBig && <p className="text-sm text-danger">El descuento no puede superar el total.</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm">Seña (opcional)</span>
          <Input aria-label="Seña (opcional)" inputMode="decimal" value={deposit} onChange={(e) => setDeposit(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm">Método de pago de la seña</span>
          <Select aria-label="Método de pago de la seña" value={depositMethod} onValueChange={setDepositMethod}
            options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))} />
        </label>
      </div>

      {unpricedLine && (
        <p className="text-sm text-danger">{unpricedLine.productName} · {unpricedLine.variantName} no tiene precio cargado — no se puede reservar.</p>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="sticky bottom-0 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-3 bg-background border-t border-border flex flex-col gap-3"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        <div className="flex items-center justify-between">
          <span className="font-medium">Total</span>
          <span className="text-lg font-semibold">{money(netTotal)}</span>
        </div>
        <Button onClick={handleSave} loading={pending} disabled={cart.length === 0 || !!unpricedLine || discountTooBig}>
          {pending ? 'Guardando…' : 'Guardar reserva'}
        </Button>
      </div>
    </div>
  )
}
