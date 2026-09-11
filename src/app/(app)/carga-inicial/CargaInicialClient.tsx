'use client'
import { FastEntryGrid } from '@/components/grid/FastEntryGrid'
import { saveInitialStockBatch } from '@/server/actions/inventory'

export function CargaInicialClient() {
  return <FastEntryGrid onSubmit={(payload) => saveInitialStockBatch(payload)} />
}
