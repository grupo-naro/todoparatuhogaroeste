import { PageSkeleton, Skeleton, TableSkeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <PageSkeleton>
      <Skeleton className="h-7 w-32 mb-4" />
      <TableSkeleton cols={4} />
    </PageSkeleton>
  )
}
