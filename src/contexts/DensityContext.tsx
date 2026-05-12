import { createContext, useContext, useEffect, ReactNode } from 'react'
import { useSettings } from './SettingsContext'
import type { AppSettings } from '../stores/settingsStore'

export type Density = AppSettings['density']

const DENSITY_CSS: Record<Density, Record<string, string>> = {
  compact:     { '--row-height': '32px', '--row-py': '4px',  '--font-size': '12px' },
  default:     { '--row-height': '40px', '--row-py': '6px',  '--font-size': '13px' },
  comfortable: { '--row-height': '44px', '--row-py': '8px',  '--font-size': '13px' },
}

const DensityContext = createContext<{
  density: Density
  setDensity: (d: Density) => void
}>({ density: 'default', setDensity: () => {} })

export function DensityProvider({ children }: { children: ReactNode }) {
  const { settings, updateSettings } = useSettings()
  const density = settings.density

  useEffect(() => {
    const vars = DENSITY_CSS[density] ?? DENSITY_CSS['default']
    Object.entries(vars).forEach(([k, v]) =>
      document.documentElement.style.setProperty(k, v)
    )
  }, [density])

  return (
    <DensityContext.Provider value={{ density, setDensity: (d) => updateSettings({ density: d }) }}>
      {children}
    </DensityContext.Provider>
  )
}

export function useDensity() {
  return useContext(DensityContext)
}
