import { useState } from 'react'
import type { GitRefs } from '../../bindings'

interface Props {
  gitRefs: GitRefs | undefined
  isLoading: boolean
}

function formatCommitDate(dateStr: string): string {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function abbrevHash(hash: string): string {
  return hash.slice(0, 7)
}

export function GitHistoryPanel({ gitRefs, isLoading }: Props) {
  const [open, setOpen] = useState(false)

  // Hide entirely when we know it's a non-git project (empty and not loading)
  if (!isLoading && gitRefs && gitRefs.commits.length === 0 && gitRefs.branches.length === 0) {
    // Still render the panel but show empty state — backend returns empty for non-git
    // The caller (TaskDetailPanel) decides whether to render this at all.
  }

  const commitCount = gitRefs?.commits.length ?? 0
  const headerLabel = open && commitCount > 0
    ? `Git history (${commitCount})`
    : 'Git history'

  return (
    <div className="rounded-lg border border-neutral-800/60 bg-neutral-900/30 overflow-hidden">
      {/* Section header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-neutral-800/30 transition-colors"
      >
        <span className="text-xs font-medium text-neutral-400">{headerLabel}</span>
        <svg
          className={`w-3.5 h-3.5 text-neutral-600 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-neutral-800/60">
          {isLoading && (
            <div className="px-4 py-3 text-xs text-neutral-600">Loading…</div>
          )}

          {!isLoading && gitRefs && (
            <>
              {/* Branch chips */}
              {gitRefs.branches.length > 0 && (
                <div className="px-4 pt-3 pb-2 flex flex-wrap gap-1.5">
                  {gitRefs.branches.map(branch => (
                    <span
                      key={branch}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-neutral-800 text-neutral-400 border border-neutral-700"
                    >
                      {/* git branch icon */}
                      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 3v12m0 0a3 3 0 100 6 3 3 0 000-6zm0 0h6a3 3 0 100-6H6" />
                      </svg>
                      {branch}
                    </span>
                  ))}
                </div>
              )}

              {/* Commit list */}
              {gitRefs.commits.length === 0 ? (
                <div className="px-4 py-3 text-xs text-neutral-600 italic">No commits reference this issue</div>
              ) : (
                <div className="divide-y divide-neutral-800/40">
                  {gitRefs.commits.map(commit => (
                    <div key={commit.hash} className="px-4 py-2.5 flex items-start gap-3">
                      <span className="font-mono text-[10px] text-blue-400/80 flex-shrink-0 mt-0.5 select-all">
                        {abbrevHash(commit.hash)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-neutral-300 truncate">{commit.subject}</div>
                        <div className="text-[10px] text-neutral-600 mt-0.5">{formatCommitDate(commit.date)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {!isLoading && !gitRefs && (
            <div className="px-4 py-3 text-xs text-neutral-600 italic">No commits reference this issue</div>
          )}
        </div>
      )}
    </div>
  )
}
