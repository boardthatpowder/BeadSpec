import { useEffect } from 'react'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { useShortcut } from '../components/shortcuts/ShortcutProvider'
import { nextStep, prevStep, DEFAULT_ZOOM } from '../stores/zoomStore'
import { useSettings } from '../contexts/SettingsContext'

async function applyZoom(factor: number) {
  try {
    await getCurrentWebview().setZoom(factor)
  } catch (e) {
    console.warn('[useZoom] setZoom failed:', e)
  }
}

export function useZoom() {
  const { settings, updateSettings } = useSettings()

  useEffect(() => {
    applyZoom(settings.zoom)
  }, [settings.zoom])

  useShortcut('=', () => {
    const next = nextStep(settings.zoom)
    if (next !== settings.zoom) updateSettings({ zoom: next })
  })

  useShortcut('-', () => {
    const prev = prevStep(settings.zoom)
    if (prev !== settings.zoom) updateSettings({ zoom: prev })
  })

  useShortcut('0', () => {
    if (settings.zoom !== DEFAULT_ZOOM) updateSettings({ zoom: DEFAULT_ZOOM })
  })
}
