import { PageSkeleton, Skeleton, TableSkeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <PageSkeleton>
      <div className="max-w-3xl space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-5 w-40" />
        <TableSkeleton rows={4} cols={4} />
        <Skeleton className="h-8 w-32 ml-auto" />
      </div>
    </PageSkeleton>
  )
}
