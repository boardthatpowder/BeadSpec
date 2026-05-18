import { useWorkspaceContext } from '../../hooks/useProject'

function valueFor(labels: string[], prefix: string): string | null {
  const label = labels.find(l => l.startsWith(prefix + ':'))
  if (!label) return null
  return label.slice(prefix.length + 1)
}

export function MismatchChips({ labels }: { labels: string[] }) {
  const ctx = useWorkspaceContext()
  if (!ctx) return null

  const issueBranch = valueFor(labels, 'branch')
  const issueWorktree = valueFor(labels, 'worktree')
  const chips: Array<{ axis: string; issue: string; current: string; label: string }> = []

  if (issueBranch && issueBranch !== ctx.branch) {
    chips.push({
      axis: 'branch',
      issue: issueBranch,
      current: ctx.branch,
      label: 'Issue branch label differs from the current git branch.',
    })
  }

  const currentWorktree = ctx.label_worktree.startsWith('worktree:')
    ? ctx.label_worktree.slice('worktree:'.length)
    : ctx.label_worktree
  if (issueWorktree && issueWorktree !== currentWorktree) {
    chips.push({
      axis: 'worktree',
      issue: issueWorktree,
      current: currentWorktree,
      label: 'Issue worktree label differs from the connected workspace.',
    })
  }

  if (chips.length === 0) return null

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {chips.map(chip => (
        <span
          key={chip.axis}
          aria-label={chip.label}
          title={chip.label}
          className="inline-flex items-center gap-1 rounded border border-amber-800/40 bg-amber-950/30 px-1.5 py-0.5 text-[10px] font-mono text-amber-300"
        >
          {chip.axis}: {chip.issue} <span className="text-amber-500/70">(current: {chip.current})</span>
        </span>
      ))}
    </div>
  )
}
