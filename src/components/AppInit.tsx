import { useEffect } from 'react'
import { listen } from '@tauri-apps/api/event'
import { useProjectStore, restoreLastProject, connectProjectWithContext } from '../hooks/useProject'
import { useToast } from './ui/Toast'
import { useZoom } from '../hooks/useZoom'

export function AppInit() {
  useZoom()
  const { setActiveProject } = useProjectStore()
  const { toast } = useToast()

  useEffect(() => {
    restoreLastProject().then(async (path) => {
      if (!path) return
      try {
        await connectProjectWithContext(path)
      } catch {
        // Stored project no longer valid — clear it
        setActiveProject(null)
      }
    })
  }, [])

  // Listen for issues created via the Quick Capture window and show a toast.
  useEffect(() => {
    const unlisten = listen<{ id: string }>('quick-capture://issue-created', (event) => {
      toast(`Created ${event.payload.id}`)
    })
    return () => { unlisten.then(fn => fn()) }
  }, [toast])

  return null
}
