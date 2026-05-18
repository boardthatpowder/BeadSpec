import { useQuery } from '@tanstack/react-query'
import { listReviews } from '../../ipc'
import type { ReviewScope } from '../../bindings'
import { ReviewRow } from './ReviewRow'

function branchFrom(labels: string[]) {
  const label = labels.find(l => l.startsWith('branch:'))
  return label?.slice('branch:'.length) ?? null
}

export function ReviewsSection({ project, labels }: { project: string; labels: string[] }) {
  const branch = branchFrom(labels)
  const scope: ReviewScope = branch ? { scope: 'Branch', value: branch } : { scope: 'All' }
  const query = useQuery({
    queryKey: ['reviews', project, scope],
    queryFn: () => listReviews(project, scope),
    enabled: !!project,
    retry: false,
  })
  if (!query.data?.length) return null
  return (
    <div className="rounded-lg border border-neutral-800/60 bg-neutral-900/30 p-4">
      <div className="mb-2 text-xs font-medium text-neutral-400">Reviews</div>
      <div className="space-y-2">
        {query.data.map(review => <ReviewRow key={review.key} review={review} />)}
      </div>
    </div>
  )
}
