import { load } from '@tauri-apps/plugin-store'

const STORE_FILE = 'settings.json'
const STORE_KEY = 'settings'

export interface NotificationPrefs {
  assignment: boolean
  unblock: boolean
  comment: boolean
  globalMute: boolean
}

export interface BinaryPaths {
  bd: string
  openspec: string
  ruflo: string
  dolt: string
}

export interface FeatureFlags {
  openspec: boolean
  ruflo: boolean
}

export interface TooltipPrefs {
  enabled: boolean
  delayMs: number
}

export interface AppSettings {
  features: FeatureFlags
  binaryPaths: BinaryPaths
  actor: string
  quickCaptureShortcut: string
  density: 'compact' | 'default' | 'comfortable'
  zoom: number
  notificationPrefs: NotificationPrefs
  tooltips: TooltipPrefs
}

export const DEFAULT_SETTINGS: AppSettings = {
  features: { openspec: true, ruflo: true },
  binaryPaths: { bd: '', openspec: '', ruflo: '', dolt: '' },
  actor: 'me',
  quickCaptureShortcut: 'CmdOrCtrl+Shift+N',
  density: 'default',
  zoom: 1.0,
  notificationPrefs: { assignment: true, unblock: true, comment: true, globalMute: false },
  tooltips: { enabled: true, delayMs: 500 },
}

async function getStore() {
  return load(STORE_FILE, { defaults: {}, autoSave: false })
}

export async function loadSettings(): Promise<AppSettings> {
  try {
    const store = await getStore()
    const raw = await store.get<Partial<AppSettings>>(STORE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    return {
      ...DEFAULT_SETTINGS,
      ...raw,
      features: { ...DEFAULT_SETTINGS.features, ...raw.features },
      binaryPaths: { ...DEFAULT_SETTINGS.binaryPaths, ...raw.binaryPaths },
      notificationPrefs: { ...DEFAULT_SETTINGS.notificationPrefs, ...raw.notificationPrefs },
      tooltips: { ...DEFAULT_SETTINGS.tooltips, ...raw.tooltips },
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  try {
    const store = await getStore()
    await store.set(STORE_KEY, settings)
    await store.save()
  } catch (e) {
    console.warn('[settingsStore] saveSettings failed:', e)
  }
}
