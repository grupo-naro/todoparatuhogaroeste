import { PageSkeleton, Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <PageSkeleton>
      <Skeleton className="h-7 w-24 mb-4" />
      <div className="flex gap-2 mb-4">
        <Skeleton className="h-11 w-20" />
        <Skeleton className="h-11 w-24" />
        <Skeleton className="h-11 w-20" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="border border-border rounded-lg p-4 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-32" />
          </div>
        ))}
      </div>
      <Skeleton className="h-6 w-32 mb-2" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-14 w-full" />)}
      </div>
    </PageSkeleton>
  )
}
