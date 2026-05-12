import { useEffect } from 'react'
import { useAppState } from '../../contexts/HashStateContext'
import { useFeatureFlag } from '../../contexts/SettingsContext'
import { Tooltip } from '../ui/Tooltip'

type View = 'all' | 'focus' | 'ready' | 'health' | 'changes'

const ALL_VIEWS: { id: View; label: string; description: string; feature?: 'openspec' | 'ruflo' }[] = [
  { id: 'all',     label: 'All',     description: 'All tasks across the project' },
  { id: 'focus',   label: 'Focus',   description: 'Tasks assigned to you' },
  { id: 'ready',   label: 'Ready',   description: 'Tasks with no blockers' },
  { id: 'health',  label: 'Health',  description: 'Project health and metrics' },
  { id: 'changes', label: 'OpenSpec', description: 'OpenSpec changes browser', feature: 'openspec' },
]

export function ViewSwitcher() {
  const { state, setState } = useAppState()
  const openspecEnabled = useFeatureFlag('openspec')
  const activeView = (state.view ?? 'all') as View

  const views = ALL_VIEWS.filter(v => v.feature !== 'openspec' || openspecEnabled)

  useEffect(() => {
    if (activeView === 'changes' && !openspecEnabled) {
      setState({ view: 'all' })
    }
  }, [openspecEnabled, activeView, setState])

  return (
    <div className="flex items-center gap-0.5 bg-neutral-800/60 rounded-lg p-0.5">
      {views.map(v => (
        <Tooltip key={v.id} label={v.label} description={v.description}>
          <button
            onClick={() => setState({ view: v.id })}
            className={[
              'px-2.5 py-1 text-xs rounded-md transition-colors font-medium',
              activeView === v.id
                ? 'bg-neutral-700 text-neutral-100'
                : 'text-neutral-500 hover:text-neutral-300',
            ].join(' ')}
          >
            {v.label}
          </button>
        </Tooltip>
      ))}
    </div>
  )
}
