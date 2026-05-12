import { clsx } from 'clsx'

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={clsx(
        'animate-pulse rounded bg-neutral-800',
        className
      )}
    />
  )
}

export function TaskRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 border-b border-neutral-800/50"
         style={{ height: 'var(--row-height, 44px)' }}>
      <Skeleton className="w-16 h-3" />
      <Skeleton className="flex-1 h-3" />
      <Skeleton className="w-12 h-5 rounded-full" />
      <Skeleton className="w-8 h-3" />
    </div>
  )
}

export function TaskListSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="flex flex-col">
      {Array.from({ length: count }).map((_, i) => (
        <TaskRowSkeleton key={i} />
      ))}
    </div>
  )
}

export function DetailPanelSkeleton() {
  return (
    <div className="p-6 flex flex-col gap-4">
      <Skeleton className="w-2/3 h-6" />
      <div className="flex gap-2">
        <Skeleton className="w-20 h-5 rounded-full" />
        <Skeleton className="w-16 h-5 rounded-full" />
      </div>
      <Skeleton className="w-full h-32 rounded-lg" />
      <Skeleton className="w-full h-4" />
      <Skeleton className="w-3/4 h-4" />
      <Skeleton className="w-1/2 h-4" />
    </div>
  )
}
