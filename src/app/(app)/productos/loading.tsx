import { PageSkeleton, Skeleton, FiltersSkeleton, TableSkeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <PageSkeleton>
      <div className="flex items-center justify-between gap-3 mb-4">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-11 w-36" />
      </div>
      <FiltersSkeleton />
      <TableSkeleton cols={5} />
    </PageSkeleton>
  )
}
