import { PageSkeleton, Skeleton, TableSkeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <PageSkeleton>
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-11 w-36" />
      </div>
      <TableSkeleton cols={5} />
    </PageSkeleton>
  )
}
