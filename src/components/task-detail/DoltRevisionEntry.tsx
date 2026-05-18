import { useState } from 'react'
import type { DoltRevision } from '../../bindings'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'

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
    return <span className="text-[--color-fg-subtle] italic">—</span>
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
          <Icon name="Info" size="sm" className="h-3 w-3 text-violet-400" />
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
          <span className="text-xs text-[--color-fg-subtle] capitalize">{revision.diff_type}</span>

          {/* Pseudo-hash */}
          {label && (
            <span className="text-xs font-mono text-[--color-fg-subtle]">{label}</span>
          )}

          {/* Expand toggle */}
          {fieldDiffs.length > 0 && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setExpanded(prev => !prev)}
              className="ml-auto text-xs text-[--color-fg-subtle] hover:text-[--color-fg-muted] hover:bg-[--color-surface-hi] px-1.5 py-0.5 rounded transition-colors"
              aria-expanded={expanded}
            >
              {expanded ? 'Hide changes' : `${fieldDiffs.length} change${fieldDiffs.length > 1 ? 's' : ''}`}
            </Button>
          )}
        </div>

        {/* Field diff table — collapsed by default */}
        {expanded && fieldDiffs.length > 0 && (
          <div className="mt-2 rounded border border-[--color-border] overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[--color-border]">
                  <th className="text-left px-2 py-1 text-[--color-fg-subtle] font-medium w-20">Field</th>
                  <th className="text-left px-2 py-1 text-[--color-fg-subtle] font-medium">Before</th>
                  <th className="text-left px-2 py-1 text-[--color-fg-subtle] font-medium">After</th>
                </tr>
              </thead>
              <tbody>
                {fieldDiffs.map(diff => (
                  <tr key={diff.field} className="border-b border-[--color-border]/60 last:border-0">
                    <td className="px-2 py-1 text-[--color-fg-muted] font-medium capitalize">{diff.field}</td>
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
          <div className="mt-1 text-xs text-[--color-fg-subtle] italic">No field changes detected</div>
        )}
      </div>
    </div>
  )
}
