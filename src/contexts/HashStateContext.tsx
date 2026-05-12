import { createContext, useContext, useEffect, ReactNode } from 'react'
import { AppHashState, useHashState } from '../hooks/useHashState'
import { useWorkspaceStore } from '../stores/workspace'
import { findLeaf } from '../utils/paneTree'

interface HashStateContextValue {
  state: AppHashState
  setState: (patch: Partial<AppHashState>) => void
}

const HashStateContext = createContext<HashStateContextValue>({
  state: {},
  setState: () => {},
})

export function HashStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useHashState()

  // Task 4.1 — one-way bridge: active workspace tab → hash taskId via replaceState.
  // Uses replaceState (not pushState) so tab switches don't create history entries.
  useEffect(() => {
    return useWorkspaceStore.subscribe((ws: { root: import('../utils/paneTree').PaneNode; activePaneId: string }) => {
      const leaf = findLeaf(ws.root, ws.activePaneId)
      const taskId = leaf?.activeTabId ?? null
      // Only update when taskId differs from what's already in the hash.
      const current = (() => { try { const h = window.location.hash.slice(1); return JSON.parse(decodeURIComponent(h)).taskId ?? null } catch { return null } })()
      if (taskId === current) return
      const next = (() => { try { const h = window.location.hash.slice(1); const s = JSON.parse(decodeURIComponent(h)); return { ...s, taskId: taskId ?? undefined } } catch { return { taskId: taskId ?? undefined } } })()
      window.history.replaceState(null, '', '#' + encodeURIComponent(JSON.stringify(next)))
    })
  }, [])

  return (
    <HashStateContext.Provider value={{ state, setState }}>
      {children}
    </HashStateContext.Provider>
  )
}

export function useAppState() {
  return useContext(HashStateContext)
}
