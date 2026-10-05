import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { invalidateProjectData } from './projectInvalidation'
import type { ProjectBackendStatus } from '../ipc'

interface TasksChangedPayload {
  project: string
  task_ids: string[]
}

/** Journal events and focus reconcile all issue-derived views in this workspace. */
export function useTauriSync(activeProject?: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    const refresh = (project: string) => {
      if (activeProject && project !== activeProject) return
      void invalidateProjectData(queryClient, project)
    }
    const listeners = [
      listen<TasksChangedPayload>('tasks_changed', event => refresh(event.payload.project)),
      listen<{ project: string }>('task_list_changed', event => refresh(event.payload.project)),
      listen<ProjectBackendStatus>('project_backend_status_changed', event => {
        queryClient.setQueryData(['project-backend-status', event.payload.project_path], event.payload)
      }),
      listen('bd_not_found', () => console.warn('[BeadSpec] bd CLI not found — install Beads 1.3 or newer')),
      getCurrentWindow().onFocusChanged(event => {
        if (event.payload && activeProject) refresh(activeProject)
      }),
    ]
    return () => {
      listeners.forEach(listener => { void listener.then(unlisten => unlisten()).catch(() => {}) })
    }
  }, [queryClient, activeProject])
}
