import { PageSkeleton, Skeleton, FiltersSkeleton, TableSkeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <PageSkeleton>
      <Skeleton className="h-7 w-36 mb-4" />
      <FiltersSkeleton />
      <TableSkeleton cols={4} />
    </PageSkeleton>
  )
}
