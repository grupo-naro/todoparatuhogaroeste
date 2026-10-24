'use client'
import { Select } from '@/components/ui/select'
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type PaymentMethodName } from '@/lib/constants'
import { money } from '@/lib/format'

export type DepositChoice = 'DEVOLVER' | 'RETENER' | null
export type DepositDecision = { action: 'DEVOLVER'; paymentMethod: PaymentMethodName } | { action: 'RETENER' }

export function toDecision(choice: DepositChoice, method: string): DepositDecision | undefined {
  if (choice === 'DEVOLVER') return { action: 'DEVOLVER', paymentMethod: method as PaymentMethodName }
  if (choice === 'RETENER') return { action: 'RETENER' }
  return undefined
}

// Qué hacer con la seña cuando la reserva se cierra: lo decide la vendedora, caso por caso.
export function DepositDecisionFields({ balance, choice, onChoice, method, onMethod }: {
  balance: number
  choice: DepositChoice
  onChoice: (c: DepositChoice) => void
  method: string
  onMethod: (m: string) => void
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm mb-1">La clienta dejó {money(balance)} de seña. ¿Qué hacemos con la seña?</legend>
      <label className="flex items-center gap-3 min-h-11 border border-border rounded px-3">
        <input type="radio" name="deposit-choice" checked={choice === 'DEVOLVER'} onChange={() => onChoice('DEVOLVER')} />
        <span>Devolver la seña</span>
      </label>
      {choice === 'DEVOLVER' && (
        <label className="flex flex-col gap-1 pl-1">
          <span className="text-sm">¿Cómo se la devolvés?</span>
          <Select aria-label="Método de la devolución" value={method} onValueChange={onMethod}
            options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))} />
        </label>
      )}
      <label className="flex items-center gap-3 min-h-11 border border-border rounded px-3">
        <input type="radio" name="deposit-choice" checked={choice === 'RETENER'} onChange={() => onChoice('RETENER')} />
        <span>Quedarme con la seña</span>
      </label>
    </fieldset>
  )
}
