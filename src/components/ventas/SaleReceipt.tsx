'use client'
import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import type { SaleDetail } from '@/server/queries/sales'
import { money, integer, formatDate } from '@/lib/format'
import { PAYMENT_METHOD_LABELS } from '@/lib/constants'
import { CancelSaleButton } from './CancelSaleButton'

export function SaleReceipt({ sale }: { sale: SaleDetail }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (searchParams.get('justCreated') === '1') {
      window.print()
      router.replace(`/ventas/${sale.id}`)
    }
  }, [searchParams, router, sale.id])

  return (
    <section className="max-w-lg mx-auto print:max-w-none">
      <div className="flex items-center justify-between mb-4 print:hidden">
        <h1 className="text-xl font-semibold">Ticket N° {sale.number}</h1>
        <div className="flex gap-2">
          <button type="button" onClick={() => window.print()}
            className="min-h-11 px-3 rounded border border-border text-sm">Imprimir</button>
          {!sale.cancelledAt && <CancelSaleButton saleId={sale.id} />}
        </div>
      </div>

      <div className="border border-border rounded-lg p-4 print:border-0 print:p-0">
        <div className="flex items-center gap-3 mb-3">
          <Image src="/logo.png" alt="" width={40} height={40} className="rounded-full" />
          <div>
            <p className="font-semibold">Jael Castillo — Todo para tu Hogar</p>
            <p className="text-xs text-muted">Ticket N° {sale.number} · {formatDate(sale.createdAt)}</p>
          </div>
        </div>
        <p className="text-sm mb-3">Vendedora: {sale.userName}</p>

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
            {sale.items.map((item) => (
              <tr key={item.variantId} className="border-b border-border">
                <td className="py-1">{item.productName} · {item.variantName}</td>
                <td className="py-1 text-right">{integer(item.quantity)}</td>
                <td className="py-1 text-right">{money(item.unitPrice)}</td>
                <td className="py-1 text-right">{money(item.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="text-right font-semibold mt-2">Total: {money(sale.total)}</p>
        <p className="text-sm mt-1">Método de pago: {PAYMENT_METHOD_LABELS[sale.paymentMethod]}</p>

        {sale.cancelledAt && (
          <p className="text-danger font-medium mt-3">
            Venta anulada el {formatDate(sale.cancelledAt)}{sale.cancelledByName ? ` por ${sale.cancelledByName}` : ''}
          </p>
        )}

        <p className="text-xs text-muted mt-4 text-center">Documento no válido como factura.</p>
      </div>
    </section>
  )
}
