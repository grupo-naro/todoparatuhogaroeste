import { PageSkeleton, Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <PageSkeleton>
      <div className="max-w-2xl space-y-4">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-11 w-40" />
      </div>
    </PageSkeleton>
  )
}
