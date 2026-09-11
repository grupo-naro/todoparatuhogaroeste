import type {
  HTMLAttributes,
  TableHTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from 'react'
import { cn } from '@/lib/cn'

export function Table({ className, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full text-sm min-w-[40rem]', className)} {...props} />
    </div>
  )
}

export function Thead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('border-b border-border text-left text-muted', className)} {...props} />
}

export function Tbody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('divide-y divide-border', className)} {...props} />
}

export function Tr({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={className} {...props} />
}

type ThProps = ThHTMLAttributes<HTMLTableCellElement> & {
  sortable?: boolean
  sorted?: 'asc' | 'desc' | false
  onSort?: () => void
}

const ariaSort = { asc: 'ascending', desc: 'descending' } as const

export function Th({ sortable, sorted = false, onSort, className, children, ...props }: ThProps) {
  return (
    <th className={cn('px-3 py-3 font-medium', className)} {...props}>
      {sortable ? (
        // brief pins aria-sort on the inner sort button; jsx-a11y expects it on the columnheader
        // eslint-disable-next-line jsx-a11y/role-supports-aria-props
        <button
          type="button"
          onClick={onSort}
          aria-sort={sorted ? ariaSort[sorted] : 'none'}
          className="min-h-11 inline-flex items-center gap-1"
        >
          {children}
          {sorted === 'asc' ? ' ↑' : sorted === 'desc' ? ' ↓' : null}
        </button>
      ) : (
        children
      )}
    </th>
  )
}

export function Td({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-3 py-3', className)} {...props} />
}
