import { PageSkeleton, Skeleton, TableSkeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <PageSkeleton>
      <Skeleton className="h-7 w-40 mb-4" />
      <Skeleton className="h-11 w-full mb-4" />
      <TableSkeleton rows={6} cols={4} />
    </PageSkeleton>
  )
}
