import { useNavigationHistory } from '../../hooks/useNavigationHistory'
import { useAppState } from '../../contexts/HashStateContext'
import { useQuery } from '@tanstack/react-query'
import { commands, unwrap } from '../../ipc'
import { useActiveProject } from '../../hooks/useProject'
import { useBackNavigation } from '../../hooks/useBackNavigation'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'

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
    <div className="flex items-center gap-1 px-6 py-2 border-b border-[--color-border] bg-[--color-bg]/50 text-xs">
      <Button
        variant="ghost"
        size="xs"
        aria-label="Go back"
        onClick={goBack}
        className="mr-1 h-auto border-0 px-1 py-0 text-[--color-fg-subtle] hover:text-[--color-fg-muted]"
      >
        <Icon name="ArrowLeft" size="sm" />
      </Button>
      {crumbs.map((id, i) => (
        <span key={`${id}-${i}`} className="flex items-center gap-1">
          {i > 0 && <Icon name="ChevronRight" size="sm" className="text-neutral-700" />}
          {id === '...' ? (
            <span className="text-[--color-fg-subtle]">…</span>
          ) : (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => navigateTo(id)}
              className={[
                'h-auto max-w-32 border-0 px-0 py-0 font-normal transition-colors',
                id === state.taskId
                  ? 'text-[--color-fg] font-medium cursor-default'
                  : 'text-[--color-fg-subtle] hover:text-[--color-fg-muted]',
              ].join(' ')}
            >
              <span className="truncate">{metas[id] ?? id}</span>
            </Button>
          )}
        </span>
      ))}
    </div>
  )
}
