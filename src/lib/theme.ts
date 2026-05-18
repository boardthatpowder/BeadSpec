import { useEffect } from 'react'
import type { AppSettings } from '../stores/settingsStore'

export type ResolvedTheme = 'dark' | 'light'

const THEME_QUERY = '(prefers-color-scheme: dark)'

export function resolveTheme(theme: AppSettings['theme'], prefersDark: boolean): ResolvedTheme {
  if (theme === 'system') return prefersDark ? 'dark' : 'light'
  return theme
}

function applyResolvedTheme(theme: ResolvedTheme) {
  document.documentElement.setAttribute('data-theme', theme)
}

export function useThemeEffect(theme: AppSettings['theme']) {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined' || !window.matchMedia) return

    const media = window.matchMedia(THEME_QUERY)
    applyResolvedTheme(resolveTheme(theme, media.matches))

    if (theme !== 'system') return

    const handleChange = (event: MediaQueryListEvent) => {
      applyResolvedTheme(resolveTheme('system', event.matches))
    }

    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [theme])
}
