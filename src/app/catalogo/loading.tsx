import { PageSkeleton, Skeleton, CardGridSkeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <PageSkeleton>
      <Skeleton className="h-7 w-32 mb-4" />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <Skeleton className="h-11 flex-1" />
        <Skeleton className="h-11 sm:w-64" />
      </div>
      <CardGridSkeleton />
    </PageSkeleton>
  )
}
