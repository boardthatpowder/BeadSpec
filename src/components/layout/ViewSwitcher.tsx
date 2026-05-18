import { useEffect } from 'react'
import { useAppState } from '../../contexts/HashStateContext'
import { useFeatureFlag } from '../../contexts/SettingsContext'
import { Tooltip } from '../ui/Tooltip'
import { useActiveProject } from '../../hooks/useProject'
import { useRufloAvailable } from '../memory-browser/useRufloAvailable'
import { type TopLevelView, viewSelectionState } from './viewSelection'
import { Button } from '../ui/Button'

const ALL_VIEWS: { id: TopLevelView; label: string; description: string; feature?: 'openspec' | 'ruflo' }[] = [
  { id: 'all',     label: 'All',     description: 'All tasks across the project' },
  { id: 'focus',   label: 'Focus',   description: 'Tasks assigned to you' },
  { id: 'ready',   label: 'Ready',   description: 'Tasks with no blockers' },
  { id: 'health',  label: 'Health',  description: 'Project health and metrics' },
  { id: 'activity', label: 'Activity', description: 'Workflow activity feed' },
  { id: 'processes', label: 'Processes', description: 'GitNexus execution flows' },
  { id: 'memory', label: 'Memory', description: 'Ruflo memory browser', feature: 'ruflo' },
  { id: 'changes', label: 'OpenSpec', description: 'OpenSpec changes browser', feature: 'openspec' },
]

export function ViewSwitcher() {
  const { state, setState } = useAppState()
  const project = useActiveProject()
  const openspecEnabled = useFeatureFlag('openspec')
  const ruflo = useRufloAvailable()
  const activeView = (state.view ?? 'all') as TopLevelView

  const views = ALL_VIEWS.filter(v => {
    if (!project && (v.id === 'activity' || v.id === 'processes' || v.id === 'memory')) return false
    if (v.feature === 'openspec') return openspecEnabled
    if (v.feature === 'ruflo') return ruflo.available
    return true
  })

  useEffect(() => {
    if ((activeView === 'changes' && !openspecEnabled) || (activeView === 'memory' && !ruflo.available)) {
      setState({ view: 'all' })
    }
  }, [openspecEnabled, ruflo.available, activeView, setState])

  return (
    <nav aria-label="Main views" className="min-w-0 overflow-x-auto">
      <div className="flex w-max items-center gap-1 rounded-lg bg-neutral-900/70 p-0.5">
      {views.map(v => (
        <Tooltip key={v.id} label={v.label} description={v.description}>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setState(viewSelectionState(v.id))}
            className={[
              'h-auto whitespace-nowrap border-0 px-2.5 py-1',
              activeView === v.id
                ? 'bg-neutral-700 text-neutral-100'
                : 'text-neutral-500 hover:text-neutral-300',
            ].join(' ')}
          >
            {v.label}
          </Button>
        </Tooltip>
      ))}
      </div>
    </nav>
  )
}
