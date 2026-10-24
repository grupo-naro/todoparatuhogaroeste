import { PageSkeleton, Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <PageSkeleton>
      <Skeleton className="h-7 w-44 mb-4" />
      <Skeleton className="h-16 w-full max-w-md mb-4" />
      <Skeleton className="h-11 w-full max-w-md" />
    </PageSkeleton>
  )
}
