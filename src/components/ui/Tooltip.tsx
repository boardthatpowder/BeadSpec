import { useContext } from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { useSettings } from '../../contexts/SettingsContext'
import { TooltipConfigContext } from './tooltipConfig'

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
          forceMount
          side="bottom"
          sideOffset={6}
          className="z-[9999] max-w-xs rounded bg-[--color-surface] border border-[--color-border-strong] px-2.5 py-1.5 shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 duration-100 motion-reduce:animate-none motion-reduce:transition-none"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs text-[--color-fg]">{label}</span>
            {shortcut && (
              <kbd className="ml-auto text-[10px] text-[--color-fg-muted] font-mono bg-[--color-surface-hi] border border-[--color-border-strong] rounded px-1 py-0.5 leading-none">
                {shortcut}
              </kbd>
            )}
          </div>
          {description && (
            <div className="text-[11px] text-[--color-fg-subtle] mt-0.5">{description}</div>
          )}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}
