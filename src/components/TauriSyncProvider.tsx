import { ReactNode } from 'react'
import { useTauriSync } from '../hooks/useTauriSync'
import { useActiveProject } from '../hooks/useProject'

export function TauriSyncProvider({ children }: { children: ReactNode }) {
  const activeProject = useActiveProject()
  useTauriSync(activeProject ?? undefined)
  return <>{children}</>
}
