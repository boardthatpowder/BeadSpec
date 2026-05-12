import { useAppState } from '../../contexts/HashStateContext'
import { useNavigationHistory } from '../../hooks/useNavigationHistory'

interface TaskLinkChipProps {
  id: string
  title: string
  /** The task ID of the current context (for pushing to navigation history) */
  fromTaskId?: string
}

/**
 * A small pill button that navigates to a task's detail pane when clicked.
 * Shows: "{id} · {title truncated to 24 chars}"
 *
 * Navigation pattern mirrors DependencyGraphTab: push current task to history,
 * then set taskId in app state.
 */
export function TaskLinkChip({ id, title, fromTaskId }: TaskLinkChipProps) {
  const { setState } = useAppState()
  const { pushTask } = useNavigationHistory()

  const truncatedTitle = title.length > 24 ? title.slice(0, 24) + '…' : title
  const shortId = id.split('-').pop() ?? id

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (fromTaskId) pushTask(fromTaskId)
    setState({ taskId: id })
  }

  return (
    <button
      onClick={handleClick}
      title={`${id} — ${title}`}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono
        bg-neutral-800/80 text-neutral-400 border border-neutral-700/50
        hover:bg-neutral-700/80 hover:text-neutral-200 hover:border-neutral-600
        transition-colors cursor-pointer leading-4 max-w-[200px] truncate"
    >
      <span className="text-neutral-600 flex-shrink-0">{shortId}</span>
      <span className="text-neutral-500 flex-shrink-0">·</span>
      <span className="truncate">{truncatedTitle}</span>
    </button>
  )
}
