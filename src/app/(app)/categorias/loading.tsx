import { PageSkeleton, Skeleton, TableSkeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <PageSkeleton>
      <div className="max-w-2xl">
        <Skeleton className="h-7 w-40 mb-4" />
        <TableSkeleton rows={5} cols={2} />
      </div>
    </PageSkeleton>
  )
}
