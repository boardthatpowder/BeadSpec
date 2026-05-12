import { useWorkspaceStore } from '../../stores/workspace'

const ISSUE_ID_RE = /\b([A-Z]+-[a-z0-9]+)\b/g

/**
 * Splits `text` on issue ID tokens (e.g. BEADSPEC-abc1) and returns a React node
 * array mixing plain text spans with clickable chip buttons.
 *
 * Clicking a chip calls `openPinned` on the workspace store, which opens the
 * task in a pinned detail tab — the same navigation path used by the task list.
 */
export function renderWithChips(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  ISSUE_ID_RE.lastIndex = 0
  while ((match = ISSUE_ID_RE.exec(text)) !== null) {
    const before = text.slice(lastIndex, match.index)
    if (before) parts.push(<span key={`t-${lastIndex}`}>{before}</span>)
    const id = match[1]
    parts.push(<IssueChip key={`chip-${match.index}`} id={id} />)
    lastIndex = ISSUE_ID_RE.lastIndex
  }

  const trailing = text.slice(lastIndex)
  if (trailing) parts.push(<span key={`t-${lastIndex}`}>{trailing}</span>)

  return parts
}

function IssueChip({ id }: { id: string }) {
  const { openPinned } = useWorkspaceStore()

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        openPinned(id)
      }}
      title={`Open ${id}`}
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono
        bg-blue-900/30 text-blue-300 border border-blue-800/40
        hover:bg-blue-800/50 hover:text-blue-200 hover:border-blue-700/60
        transition-colors cursor-pointer mx-0.5 leading-4"
    >
      {id}
    </button>
  )
}
