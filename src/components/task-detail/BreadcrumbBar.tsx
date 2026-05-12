import { useNavigationHistory } from '../../hooks/useNavigationHistory'
import { useAppState } from '../../contexts/HashStateContext'
import { useQuery } from '@tanstack/react-query'
import { commands, unwrap } from '../../ipc'
import { useActiveProject } from '../../hooks/useProject'
import { IconButton } from '../ui/IconButton'
import { useBackNavigation } from '../../hooks/useBackNavigation'

export function BreadcrumbBar() {
  const { history } = useNavigationHistory()
  const { state, setState } = useAppState()
  const project = useActiveProject()
  const { goBack, canGoBack } = useBackNavigation()

  // Fetch titles for all history items
  const { data: metas = {} } = useQuery<Record<string, string>>({
    queryKey: ['breadcrumb-titles', project, history.join(',')],
    queryFn: async () => {
      if (!project || !history.length) return {}
      const results = await Promise.all(
        history.map(id =>
          unwrap(commands.getTask(project, id))
            .then(t => [id, t.title] as [string, string])
            .catch(() => [id, id] as [string, string])
        )
      )
      return Object.fromEntries(results)
    },
    enabled: !!project && history.length > 0,
    staleTime: 60_000,
  })

  if (!canGoBack || history.length <= 1) return null

  // Show first, ellipsis if >3, last two
  const crumbs = history.length > 3
    ? [history[0], '...', ...history.slice(-2)]
    : history

  const navigateTo = (id: string) => {
    if (id === '...') return
    const idx = history.indexOf(id)
    if (idx >= 0) {
      // Pop to this point
      useNavigationHistory.setState({ history: history.slice(0, idx + 1), canGoBack: idx > 0 })
      setState({ taskId: id })
    }
  }

  return (
    <div className="flex items-center gap-1 px-6 py-2 border-b border-neutral-800 bg-neutral-950/50 text-xs">
      <IconButton
        label="Go back"
        onClick={goBack}
        className="text-neutral-500 hover:text-neutral-300 transition-colors mr-1"
      >
        ←
      </IconButton>
      {crumbs.map((id, i) => (
        <span key={`${id}-${i}`} className="flex items-center gap-1">
          {i > 0 && <span className="text-neutral-700">›</span>}
          {id === '...' ? (
            <span className="text-neutral-600">…</span>
          ) : (
            <button
              onClick={() => navigateTo(id)}
              className={[
                'transition-colors max-w-32 truncate',
                id === state.taskId
                  ? 'text-neutral-200 font-medium cursor-default'
                  : 'text-neutral-500 hover:text-neutral-300',
              ].join(' ')}
            >
              {metas[id] ?? id}
            </button>
          )}
        </span>
      ))}
    </div>
  )
}
