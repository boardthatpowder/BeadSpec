import { createContext, useContext } from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { useSettings } from '../../contexts/SettingsContext'

interface TooltipConfig {
  enabled: boolean
  delayMs: number
}

export const TooltipConfigContext = createContext<TooltipConfig>({ enabled: true, delayMs: 500 })

export function AppTooltipProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings()
  const { enabled, delayMs } = settings.tooltips
  return (
    <TooltipConfigContext.Provider value={{ enabled, delayMs }}>
      <TooltipPrimitive.Provider delayDuration={delayMs}>
        {children}
      </TooltipPrimitive.Provider>
    </TooltipConfigContext.Provider>
  )
}

interface TooltipProps {
  label: string
  shortcut?: string
  description?: string
  children: React.ReactNode
}

export function Tooltip({ label, shortcut, description, children }: TooltipProps) {
  const { enabled } = useContext(TooltipConfigContext)
  if (!enabled) return <>{children}</>
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>
        {children}
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side="bottom"
          sideOffset={6}
          className="z-[9999] max-w-xs rounded bg-neutral-900 border border-neutral-700 px-2.5 py-1.5 shadow-lg"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-200">{label}</span>
            {shortcut && (
              <kbd className="ml-auto text-[10px] text-neutral-400 font-mono bg-neutral-800 border border-neutral-700 rounded px-1 py-0.5 leading-none">
                {shortcut}
              </kbd>
            )}
          </div>
          {description && (
            <div className="text-[11px] text-neutral-500 mt-0.5">{description}</div>
          )}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}
