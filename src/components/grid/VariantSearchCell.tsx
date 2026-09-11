'use client'
import { useEffect, useRef, useState } from 'react'
import type { VariantOption } from './types'

export function VariantSearchCell({
  rowIndex, value, onSelect, onKeyDown,
}: {
  rowIndex: number
  value: VariantOption | null
  onSelect: (o: VariantOption) => void
  onKeyDown: (e: React.KeyboardEvent, row: number, col: 'search') => void
}) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<VariantOption[]>([])
  const [open, setOpen] = useState(false)
  const abort = useRef<AbortController | null>(null)

  useEffect(() => {
    if (value) return
    const term = q.trim()
    // Debounce the real search; clear results on the next tick (not synchronously
    // in the effect body) when the term is too short to search — avoids
    // calling setState directly within the effect (react-hooks/set-state-in-effect).
    const t = setTimeout(async () => {
      if (term.length < 2) { setResults([]); return }
      abort.current?.abort()
      abort.current = new AbortController()
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: abort.current.signal })
        const body = await res.json()
        setResults(body.results as VariantOption[])
        setOpen(true)
      } catch { /* abortada */ }
    }, term.length < 2 ? 0 : 250)
    return () => clearTimeout(t)
  }, [q, value])

  if (value) {
    return (
      <button type="button" data-cell={`${rowIndex}:search`}
        className="text-left text-sm underline"
        onClick={() => { onSelect(null as unknown as VariantOption); setQ('') }}>
        {value.productName} — {value.variantName} <span className="text-muted">({value.categoryName})</span>
      </button>
    )
  }

  return (
    <div className="relative">
      <input data-cell={`${rowIndex}:search`} placeholder="Buscar producto…" value={q}
        onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => onKeyDown(e, rowIndex, 'search')}
        className="w-full border border-border rounded px-2 py-1 text-sm" />
      {open && results.length > 0 && (
        <ul className="absolute z-10 mt-1 w-72 max-h-56 overflow-auto bg-card border border-border rounded shadow">
          {results.map((o) => (
            <li key={o.variantId}>
              <button type="button" className="block w-full text-left px-2 py-1 text-sm hover:bg-border/40"
                onClick={() => { onSelect(o); setOpen(false); requestAnimationFrame(() => {
                  document.querySelector<HTMLElement>(`[data-cell="${rowIndex}:counted"]`)?.focus()
                }) }}>
                {o.productName} — {o.variantName} <span className="text-muted">({o.categoryName})</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
