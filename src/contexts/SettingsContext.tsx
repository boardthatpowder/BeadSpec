import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { loadSettings, saveSettings, AppSettings, DEFAULT_SETTINGS } from '../stores/settingsStore'
import type { FeatureFlags } from '../stores/settingsStore'

interface SettingsContextValue {
  settings: AppSettings
  updateSettings: (patch: Partial<AppSettings>) => void
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  updateSettings: () => {},
})

function migrateFromLocalStorage(loaded: AppSettings): AppSettings {
  let migrated = loaded
  let changed = false

  const density = localStorage.getItem('density')
  if (density && loaded.density === DEFAULT_SETTINGS.density) {
    const valid = ['compact', 'default', 'comfortable'] as const
    if (valid.includes(density as typeof valid[number])) {
      migrated = { ...migrated, density: density as AppSettings['density'] }
      changed = true
    }
    localStorage.removeItem('density')
  }

  const actor = localStorage.getItem('beads-actor')
  if (actor && loaded.actor === DEFAULT_SETTINGS.actor) {
    migrated = { ...migrated, actor }
    changed = true
    localStorage.removeItem('beads-actor')
  }

  const rawPrefs = localStorage.getItem('notification-prefs')
  if (rawPrefs) {
    try {
      const parsed = JSON.parse(rawPrefs)
      const isDefault =
        loaded.notificationPrefs.assignment === DEFAULT_SETTINGS.notificationPrefs.assignment &&
        loaded.notificationPrefs.unblock === DEFAULT_SETTINGS.notificationPrefs.unblock &&
        loaded.notificationPrefs.comment === DEFAULT_SETTINGS.notificationPrefs.comment &&
        loaded.notificationPrefs.globalMute === DEFAULT_SETTINGS.notificationPrefs.globalMute
      if (isDefault) {
        migrated = { ...migrated, notificationPrefs: { ...DEFAULT_SETTINGS.notificationPrefs, ...parsed } }
        changed = true
      }
    } catch { /* ignore */ }
    localStorage.removeItem('notification-prefs')
  }

  if (changed) saveSettings(migrated)
  return migrated
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)

  useEffect(() => {
    loadSettings().then(loaded => {
      const migrated = migrateFromLocalStorage(loaded)
      setSettings(migrated)
    })
  }, [])

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch }
      saveSettings(next)
      return next
    })
  }, [])

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  return useContext(SettingsContext)
}

export function useFeatureFlag(key: keyof FeatureFlags): boolean {
  const { settings } = useContext(SettingsContext)
  return settings.features[key]
}
