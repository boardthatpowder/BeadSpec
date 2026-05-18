import { beforeEach, describe, expect, it, vi } from 'vitest'

const storeState = new Map<string, unknown>()
const save = vi.fn(async () => {})

vi.mock('@tauri-apps/plugin-store', () => ({
  load: vi.fn(async () => ({
    get: vi.fn(async (key: string) => storeState.get(key)),
    set: vi.fn(async (key: string, value: unknown) => {
      storeState.set(key, value)
    }),
    save,
  })),
}))

import { DEFAULT_SETTINGS, loadSettings, saveSettings } from './settingsStore'

describe('settingsStore theme settings', () => {
  beforeEach(() => {
    storeState.clear()
    save.mockClear()
  })

  it('defaults theme to system', () => {
    expect(DEFAULT_SETTINGS.theme).toBe('system')
  })

  it('migrates older settings without a theme to system', async () => {
    storeState.set('settings', { density: 'compact' })

    const settings = await loadSettings()

    expect(settings.theme).toBe('system')
    expect(settings.density).toBe('compact')
  })

  it('persists explicit theme selections', async () => {
    await saveSettings({ ...DEFAULT_SETTINGS, theme: 'light' })

    expect(storeState.get('settings')).toMatchObject({ theme: 'light' })
    expect(save).toHaveBeenCalledTimes(1)
  })
})
