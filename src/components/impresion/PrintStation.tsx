'use client'
import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import type { PrintableJob } from '@/server/printing/station'
import { SaleDocument } from '@/components/ventas/SaleDocument'
import { QuoteDocument } from '@/components/ventas/QuoteDocument'

const POLL_MS = 5000

type Status =
  | { kind: 'inicio' }
  | { kind: 'ok'; at: Date }
  | { kind: 'clave' }
  | { kind: 'red' }

function hhmmss(d: Date): string {
  return d.toLocaleTimeString('es-AR', { hour12: false, timeZone: 'America/Argentina/Buenos_Aires' })
}

export function PrintStation({ clave }: { clave: string }) {
  const [status, setStatus] = useState<Status>({ kind: 'inicio' })
  const [printedCount, setPrintedCount] = useState(0)
  const [current, setCurrent] = useState<PrintableJob | null>(null)
  const printed = useRef(new Set<string>())

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const headers = { 'x-print-key': clave, 'content-type': 'application/json' }

    async function markPrinted(id: string) {
      try {
        await fetch('/api/impresion/marcar', { method: 'POST', headers, body: JSON.stringify({ id }) })
      } catch {
        // se reintenta en la próxima revisión: el servidor lo sigue listando
      }
    }

    async function check() {
      try {
        const res = await fetch('/api/impresion/pendientes', { headers, cache: 'no-store' })
        if (cancelled) return
        if (res.status === 401) {
          setStatus({ kind: 'clave' })
          return
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const { jobs } = (await res.json()) as { jobs: PrintableJob[] }
        for (const job of jobs) {
          if (cancelled) return
          if (!printed.current.has(job.id)) {
            try {
              flushSync(() => setCurrent(job))
              window.print()
            } catch {
              continue
            }
            printed.current.add(job.id)
            setPrintedCount((n) => n + 1)
          }
          await markPrinted(job.id)
        }
        setCurrent(null)
        setStatus({ kind: 'ok', at: new Date() })
      } catch {
        if (!cancelled) setStatus({ kind: 'red' })
      }
    }

    async function loop() {
      await check()
      if (!cancelled) timer = setTimeout(loop, POLL_MS)
    }
    void loop()

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [clave])

  return (
    <>
      <style>{'@media print { @page { size: A4; margin: 0 } }'}</style>
      <main className="min-h-full grid place-items-center p-6 print:hidden">
        <div className="w-full max-w-md border border-border rounded-lg p-6 space-y-3 text-center">
          <h1 className="text-xl font-semibold">Estación de impresión</h1>
          {status.kind === 'inicio' && <p className="text-muted">Conectando…</p>}
          {status.kind === 'ok' && (
            <p className="text-success font-medium">Conectada · última revisión {hhmmss(status.at)}</p>
          )}
          {status.kind === 'clave' && (
            <p role="alert" className="text-danger font-medium">
              Clave incorrecta. Revisá el acceso directo de la estación.
            </p>
          )}
          {status.kind === 'red' && (
            <p role="alert" className="text-danger font-medium">Sin conexión con el sistema. Reintentando…</p>
          )}
          <p className="text-sm text-muted">Impresos en esta sesión: {printedCount}</p>
          <p className="text-xs text-muted">Dejá esta ventana abierta durante el horario de atención.</p>
        </div>
      </main>
      <div className="hidden print:block">
        {current && (
          <div className="mx-auto max-w-[180mm] p-[15mm]">
            {current.kind === 'VENTA' ? <SaleDocument sale={current.sale} /> : <QuoteDocument quote={current.quote} />}
          </div>
        )}
      </div>
    </>
  )
}
