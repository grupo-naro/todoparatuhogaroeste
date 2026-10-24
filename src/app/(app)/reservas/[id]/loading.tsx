import { PageSkeleton, Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <PageSkeleton>
      <Skeleton className="h-7 w-48 mb-4" />
      <Skeleton className="h-24 w-full max-w-2xl mb-4" />
      <Skeleton className="h-11 w-full max-w-2xl mb-4" />
      <Skeleton className="h-40 w-full max-w-2xl" />
    </PageSkeleton>
  )
}
