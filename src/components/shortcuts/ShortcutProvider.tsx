import { createContext, useContext, ReactNode } from 'react'
import { useHotkeys, Options } from 'react-hotkeys-hook'

type Modifier = 'meta' | 'ctrl'

const isMac = () =>
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent)

const ShortcutContext = createContext<Modifier>('ctrl')

export function ShortcutProvider({ children }: { children: ReactNode }) {
  const mod: Modifier = isMac() ? 'meta' : 'ctrl'
  return <ShortcutContext.Provider value={mod}>{children}</ShortcutContext.Provider>
}

export function usePlatformKey(): Modifier {
  return useContext(ShortcutContext)
}

/** Register a shortcut with the correct platform modifier pre-applied. */
export function useShortcut(
  key: string,
  handler: () => void,
  options?: Options
) {
  const mod = usePlatformKey()
  useHotkeys(`${mod}+${key}`, handler, options ?? {})
}

/** Human-readable modifier label for display in UI. */
export function useModifierLabel(): string {
  const mod = usePlatformKey()
  return mod === 'meta' ? '⌘' : 'Ctrl'
}
