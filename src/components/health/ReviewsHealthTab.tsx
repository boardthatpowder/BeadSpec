import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listReviews } from '../../ipc'
import type { ReviewScope } from '../../bindings'
import { ReviewRow } from '../reviews/ReviewRow'

const KINDS = ['pr-review', 'code-review', 'security-review'] as const

export function ReviewsHealthTab({ project }: { project: string }) {
  const [search, setSearch] = useState('')
  const [activeKinds, setActiveKinds] = useState<Set<string>>(() => new Set(KINDS))
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const scope: ReviewScope = { scope: 'All' }
  const query = useQuery({
    queryKey: ['reviews', project, 'all'],
    queryFn: () => listReviews(project, scope),
    enabled: !!project,
    retry: false,
  })
  const groups = useMemo(() => {
    const text = search.trim().toLowerCase()
    const rows = (query.data ?? []).filter(r => {
      if (!activeKinds.has(r.kind_raw)) return false
      if (!text) return true
      return r.title.toLowerCase().includes(text) || r.body.toLowerCase().includes(text)
    })
    const grouped = new Map<string, typeof rows>()
    for (const row of rows) {
      const branch = row.branch ?? 'unscoped'
      grouped.set(branch, [...(grouped.get(branch) ?? []), row])
    }
    return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [activeKinds, query.data, search])

  const rowsCount = groups.reduce((sum, [, rows]) => sum + rows.length, 0)

  return (
    <div className="h-full overflow-auto p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-neutral-200">Captured reviews</div>
          <div className="text-xs text-neutral-600">{rowsCount} matching rows</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {KINDS.map(kind => {
            const active = activeKinds.has(kind)
            return (
              <button
                key={kind}
                onClick={() => setActiveKinds(prev => {
                  const next = new Set(prev)
                  active ? next.delete(kind) : next.add(kind)
                  return next
                })}
                className={`rounded border px-2 py-1 text-xs ${active ? 'border-blue-800 bg-blue-950/30 text-blue-300' : 'border-neutral-800 text-neutral-500'}`}
              >
                {kind.replace('-review', '')}
              </button>
            )
          })}
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search reviews" className="rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm" />
        </div>
      </div>
      {query.isLoading ? <div className="text-sm text-neutral-600">Loading…</div> : rowsCount === 0 ? (
        <div className="text-sm text-neutral-600">No reviews captured yet. Run a review skill and pipe through `scripts/bd-capture-review.sh`.</div>
      ) : (
        <div className="space-y-3">
          {groups.map(([branch, rows]) => {
            const isCollapsed = collapsed.has(branch)
            return (
              <section key={branch} className="rounded border border-neutral-800 bg-neutral-950/30">
                <button
                  onClick={() => setCollapsed(prev => {
                    const next = new Set(prev)
                    isCollapsed ? next.delete(branch) : next.add(branch)
                    return next
                  })}
                  className="flex w-full items-center justify-between px-3 py-2 text-left"
                >
                  <span className="font-mono text-xs text-neutral-300">{branch}</span>
                  <span className="text-xs text-neutral-600">{rows.length}</span>
                </button>
                {!isCollapsed && <div className="space-y-2 border-t border-neutral-800 p-2">{rows.map(r => <ReviewRow key={r.key} review={r} />)}</div>}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
