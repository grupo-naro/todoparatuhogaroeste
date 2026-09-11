import type { VariantOption } from '@/server/queries/products'
export type { VariantOption }
export type GridRow = { key: string; variant: VariantOption | null; counted: string; error?: string }
