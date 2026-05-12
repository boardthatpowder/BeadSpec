/**
 * Persistence for layout preferences in layout.json via @tauri-apps/plugin-store.
 * Handles groupBy (serialized GroupConfig) and any future layout keys.
 */
import { load } from '@tauri-apps/plugin-store'

const STORE_FILE = 'layout.json'
const GROUP_BY_KEY = 'groupBy'

async function getStore() {
  return load(STORE_FILE, { defaults: {}, autoSave: false })
}

/** Read the persisted groupBy value. Returns null if not set or on error. */
export async function readGroupBy(): Promise<string | null> {
  try {
    const store = await getStore()
    const value = await store.get<string | null>(GROUP_BY_KEY)
    return value ?? null
  } catch (e) {
    console.warn('[layoutStore] readGroupBy failed:', e)
    return null
  }
}

/** Persist the groupBy value. null removes it. Fire-and-forget safe. */
export async function writeGroupBy(value: string | null): Promise<void> {
  try {
    const store = await getStore()
    if (value === null) {
      await store.delete(GROUP_BY_KEY)
    } else {
      await store.set(GROUP_BY_KEY, value)
    }
    await store.save()
  } catch (e) {
    console.warn('[layoutStore] writeGroupBy failed:', e)
  }
}

