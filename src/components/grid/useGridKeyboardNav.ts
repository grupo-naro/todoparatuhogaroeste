'use client'
import type { KeyboardEvent } from 'react'

function focusCell(row: number, col: 'search' | 'counted') {
  const el = document.querySelector<HTMLElement>(`[data-cell="${row}:${col}"]`)
  el?.focus()
  if (el instanceof HTMLInputElement) el.select()
}

export function useGridKeyboardNav(opts: { onAddRow: () => void; onDeleteRow: (i: number) => void }) {
  return function onKeyDown(e: KeyboardEvent, rowIndex: number, col: 'search' | 'counted') {
    if (col === 'counted' && e.key === 'Enter') {
      e.preventDefault()
      opts.onAddRow()
      // la fila nueva se agrega al final; enfocá su celda de búsqueda tras el re-render
      requestAnimationFrame(() => focusCell(rowIndex + 1, 'search'))
    } else if (col === 'counted' && e.key === 'ArrowUp') {
      e.preventDefault()
      focusCell(Math.max(0, rowIndex - 1), 'counted')
    } else if (col === 'counted' && e.key === 'ArrowDown') {
      e.preventDefault()
      focusCell(rowIndex + 1, 'counted')
    } else if (e.key === 'Escape') {
      e.preventDefault()
      opts.onDeleteRow(rowIndex)
    }
  }
}
