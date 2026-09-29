import Link from 'next/link'

export function Pagination({
  page, pageSize, total, basePath, query = {},
}: { page: number; pageSize: number; total: number; basePath: string; query?: Record<string, string | undefined> }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (pages <= 1) return null
  const href = (p: number) => {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(query)) if (v) params.set(k, v)
    if (p > 1) params.set('page', String(p))
    const qs = params.toString()
    return qs ? `${basePath}?${qs}` : basePath
  }
  const linkCls = 'inline-flex items-center justify-center min-h-11 px-3 rounded border border-border text-sm'
  const disabledCls = `${linkCls} opacity-50 pointer-events-none`
  return (
    <nav aria-label="Paginación" className="mt-4 flex items-center justify-between gap-3">
      {page > 1
        ? <Link href={href(page - 1)} className={linkCls}>Anterior</Link>
        : <span aria-disabled="true" className={disabledCls}>Anterior</span>}
      <span className="text-sm text-muted">Página {page} de {pages}</span>
      {page < pages
        ? <Link href={href(page + 1)} className={linkCls}>Siguiente</Link>
        : <span aria-disabled="true" className={disabledCls}>Siguiente</span>}
    </nav>
  )
}
