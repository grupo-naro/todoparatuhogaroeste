import { PageSkeleton, Skeleton, TableSkeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <PageSkeleton>
      <div className="max-w-3xl">
        <Skeleton className="h-7 w-36 mb-4" />
        <TableSkeleton rows={5} cols={3} />
      </div>
    </PageSkeleton>
  )
}
