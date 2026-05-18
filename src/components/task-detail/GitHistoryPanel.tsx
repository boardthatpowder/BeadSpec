import { useState } from 'react'
import type { GitRefs } from '../../bindings'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'

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
    <div className="rounded-lg border border-[--color-border]/60 bg-[--color-surface]/30 overflow-hidden">
      {/* Section header */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(o => !o)}
        className="h-auto w-full justify-between rounded-none border-0 px-4 py-3 text-left font-normal hover:bg-[--color-surface-hi]/30"
      >
        <span className="text-xs font-medium text-[--color-fg-muted]">{headerLabel}</span>
        <Icon
          name="ChevronDown"
          size="sm"
          className={`w-3.5 h-3.5 text-[--color-fg-subtle] transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          strokeWidth={2}
        />
      </Button>

      {open && (
        <div className="border-t border-[--color-border]/60">
          {isLoading && (
            <div className="px-4 py-3 text-xs text-[--color-fg-subtle]">Loading…</div>
          )}

          {!isLoading && gitRefs && (
            <>
              {/* Branch chips */}
              {gitRefs.branches.length > 0 && (
                <div className="px-4 pt-3 pb-2 flex flex-wrap gap-1.5">
                  {gitRefs.branches.map(branch => (
                    <span
                      key={branch}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-[--color-surface-hi] text-[--color-fg-muted] border border-[--color-border-strong]"
                    >
                      <Icon name="GitBranch" size="sm" className="h-2.5 w-2.5" strokeWidth={2} />
                      {branch}
                    </span>
                  ))}
                </div>
              )}

              {/* Commit list */}
              {gitRefs.commits.length === 0 ? (
                <div className="px-4 py-3 text-xs text-[--color-fg-subtle] italic">No commits reference this issue</div>
              ) : (
                <div className="divide-y divide-neutral-800/40">
                  {gitRefs.commits.map(commit => (
                    <div key={commit.hash} className="px-4 py-2.5 flex items-start gap-3">
                      <span className="font-mono text-[10px] text-blue-400/80 flex-shrink-0 mt-0.5 select-all">
                        {abbrevHash(commit.hash)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-[--color-fg-muted] truncate">{commit.subject}</div>
                        <div className="text-[10px] text-[--color-fg-subtle] mt-0.5">{formatCommitDate(commit.date)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {!isLoading && !gitRefs && (
            <div className="px-4 py-3 text-xs text-[--color-fg-subtle] italic">No commits reference this issue</div>
          )}
        </div>
      )}
    </div>
  )
}
