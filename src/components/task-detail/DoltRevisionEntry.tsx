import { useState } from 'react'
import type { DoltRevision } from '../../bindings'

interface Props {
  revision: DoltRevision
}

interface FieldDiff {
  field: string
  fromValue: string | null
  toValue: string | null
}

/** Derive field-level diffs from the flat DoltRevision row. */
function deriveFieldDiffs(revision: DoltRevision): FieldDiff[] {
  const diffs: FieldDiff[] = []

  const pairs: Array<{ field: string; from: string | null; to: string | null }> = [
    { field: 'title',  from: revision.from_title,  to: revision.to_title  },
    { field: 'status', from: revision.from_status, to: revision.to_status },
    { field: 'id',     from: revision.from_id,     to: revision.to_id     },
  ]

  for (const { field, from, to } of pairs) {
    // Include if either side is non-null and they differ
    if (from !== to && (from !== null || to !== null)) {
      diffs.push({ field, fromValue: from, toValue: to })
    }
  }

  return diffs
}

/** Abbreviated commit-like label derived from diff_type and ID fields. */
function revisionLabel(revision: DoltRevision): string {
  const id = revision.to_id ?? revision.from_id ?? ''
  // Take first 7 chars as a pseudo-hash
  return id.slice(0, 7) || revision.diff_type
}

function NullableValue({ value, variant }: { value: string | null; variant: 'from' | 'to' }) {
  if (value === null || value === undefined) {
    return <span className="text-neutral-600 italic">—</span>
  }
  if (variant === 'from') {
    return <span className="text-red-400 line-through">{value}</span>
  }
  return <span className="text-green-400">{value}</span>
}

export function DoltRevisionEntry({ revision }: Props) {
  const [expanded, setExpanded] = useState(false)
  const fieldDiffs = deriveFieldDiffs(revision)
  const label = revisionLabel(revision)

  return (
    <div className="flex gap-3">
      {/* Timeline dot — violet for Dolt */}
      <div className="relative flex flex-col items-center">
        <div className="w-6 h-6 rounded-full bg-violet-900/40 border border-violet-700/50 flex items-center justify-center flex-shrink-0">
          <svg className="w-3 h-3 text-violet-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18a8 8 0 100-16 8 8 0 000 16zm-1-11h2v6h-2zm0-4h2v2h-2z" />
          </svg>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-2">
        {/* Header row */}
        <div className="flex items-baseline gap-2 flex-wrap">
          {/* Source badge */}
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-violet-900/30 text-violet-400 border border-violet-800/40 font-medium">
            Dolt
          </span>

          {/* Diff type */}
          <span className="text-xs text-neutral-500 capitalize">{revision.diff_type}</span>

          {/* Pseudo-hash */}
          {label && (
            <span className="text-xs font-mono text-neutral-600">{label}</span>
          )}

          {/* Expand toggle */}
          {fieldDiffs.length > 0 && (
            <button
              onClick={() => setExpanded(prev => !prev)}
              className="ml-auto text-xs text-neutral-600 hover:text-neutral-400 hover:bg-neutral-700 px-1.5 py-0.5 rounded transition-colors"
              aria-expanded={expanded}
            >
              {expanded ? 'Hide changes' : `${fieldDiffs.length} change${fieldDiffs.length > 1 ? 's' : ''}`}
            </button>
          )}
        </div>

        {/* Field diff table — collapsed by default */}
        {expanded && fieldDiffs.length > 0 && (
          <div className="mt-2 rounded border border-neutral-800 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-neutral-800">
                  <th className="text-left px-2 py-1 text-neutral-500 font-medium w-20">Field</th>
                  <th className="text-left px-2 py-1 text-neutral-500 font-medium">Before</th>
                  <th className="text-left px-2 py-1 text-neutral-500 font-medium">After</th>
                </tr>
              </thead>
              <tbody>
                {fieldDiffs.map(diff => (
                  <tr key={diff.field} className="border-b border-neutral-800/60 last:border-0">
                    <td className="px-2 py-1 text-neutral-400 font-medium capitalize">{diff.field}</td>
                    <td className="px-2 py-1">
                      <NullableValue value={diff.fromValue} variant="from" />
                    </td>
                    <td className="px-2 py-1">
                      <NullableValue value={diff.toValue} variant="to" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* No-diff fallback */}
        {expanded && fieldDiffs.length === 0 && (
          <div className="mt-1 text-xs text-neutral-600 italic">No field changes detected</div>
        )}
      </div>
    </div>
  )
}
