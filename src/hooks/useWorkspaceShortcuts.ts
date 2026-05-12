// Platform-aware keyboard shortcuts for the workspace.
// Mounted once near the workspace root (task 9.2).
import { useHotkeys } from 'react-hotkeys-hook'
import { useQueryClient } from '@tanstack/react-query'
import { useWorkspaceStore } from '../stores/workspace'

export function useWorkspaceShortcuts() {
  const queryClient = useQueryClient()
  const {
    activePaneId,
    closeTab,
    reopenLast,
    splitPane,
  } = useWorkspaceStore()

  // Lazy getter for active leaf tabs (avoids stale closure).
  function activeLeaf() {
    const r = useWorkspaceStore.getState().root
    const id = useWorkspaceStore.getState().activePaneId
    return r.kind === 'leaf' && r.id === id ? r : null
  }

  // mod+r — global refresh
  useHotkeys('mod+r', (e) => {
    e.preventDefault()
    queryClient.invalidateQueries()
  }, { enableOnFormTags: false })

  // mod+w — close active tab
  useHotkeys('mod+w', (e) => {
    e.preventDefault()
    const leaf = activeLeaf()
    if (!leaf?.activeTabId) return
    closeTab(activePaneId, leaf.activeTabId)
  }, { enableOnFormTags: false })

  // mod+shift+t — reopen recently closed
  useHotkeys('mod+shift+t', (e) => {
    e.preventDefault()
    reopenLast()
  }, { enableOnFormTags: false })

  // mod+\ — split right
  useHotkeys('mod+\\', (e) => {
    e.preventDefault()
    splitPane(activePaneId, 'horizontal')
  }, { enableOnFormTags: false })

  // mod+shift+\ — split down
  useHotkeys('mod+shift+\\', (e) => {
    e.preventDefault()
    splitPane(activePaneId, 'vertical')
  }, { enableOnFormTags: false })

  // ctrl+tab — next tab
  useHotkeys('ctrl+tab', (e) => {
    e.preventDefault()
    const { setActiveTab } = useWorkspaceStore.getState()
    const leaf = activeLeaf()
    if (!leaf || leaf.tabs.length < 2) return
    const idx = leaf.tabs.findIndex((t) => t.id === (leaf.activeTabId ?? ''))
    const next = leaf.tabs[(idx + 1) % leaf.tabs.length]
    setActiveTab(activePaneId, next.id)
  }, { enableOnFormTags: false })

  // ctrl+shift+tab — prev tab
  useHotkeys('ctrl+shift+tab', (e) => {
    e.preventDefault()
    const { setActiveTab } = useWorkspaceStore.getState()
    const leaf = activeLeaf()
    if (!leaf || leaf.tabs.length < 2) return
    const idx = leaf.tabs.findIndex((t) => t.id === (leaf.activeTabId ?? ''))
    const prev = leaf.tabs[(idx - 1 + leaf.tabs.length) % leaf.tabs.length]
    setActiveTab(activePaneId, prev.id)
  }, { enableOnFormTags: false })

  // mod+1..9 — jump to tab N
  for (let n = 1; n <= 9; n++) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useHotkeys(`mod+${n}`, (e) => {
      e.preventDefault()
      const { setActiveTab } = useWorkspaceStore.getState()
      const leaf = activeLeaf()
      if (!leaf || n > leaf.tabs.length) return
      setActiveTab(activePaneId, leaf.tabs[n - 1].id)
    }, { enableOnFormTags: false })
  }
}
