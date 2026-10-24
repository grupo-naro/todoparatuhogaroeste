import { CardGridSkeleton, PageSkeleton, Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <PageSkeleton>
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-11 w-40" />
      </div>
      <Skeleton className="h-11 w-72 mb-4" />
      <CardGridSkeleton count={6} />
    </PageSkeleton>
  )
}
