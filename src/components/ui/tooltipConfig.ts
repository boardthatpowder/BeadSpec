import { createContext } from 'react'

interface TooltipConfig {
  enabled: boolean
  delayMs: number
}

export const TooltipConfigContext = createContext<TooltipConfig>({ enabled: true, delayMs: 500 })
