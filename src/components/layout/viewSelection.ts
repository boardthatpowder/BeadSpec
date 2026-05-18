export type TopLevelView = 'all' | 'focus' | 'ready' | 'health' | 'changes' | 'activity' | 'processes' | 'memory'

export function viewSelectionState(view: TopLevelView): { view: TopLevelView; memoryNamespace?: string } {
  if (view === 'memory') {
    return { view, memoryNamespace: undefined }
  }
  return { view }
}
