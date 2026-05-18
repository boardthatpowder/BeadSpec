import type { ReactNode } from 'react'

interface PanelHeaderProps {
  title: string
  description?: string
  filters?: ReactNode
  actions?: ReactNode
}

export function PanelHeader({ title, description, filters, actions }: PanelHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-(--color-border) px-5 py-4">
      <div className="min-w-0">
        <h2 className="truncate text-base font-semibold text-(--color-fg)">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-(--color-fg-muted)">{description}</p>}
      </div>
      {(filters || actions) && (
        <div className="flex shrink-0 items-center gap-2">
          {filters}
          {actions}
        </div>
      )}
    </header>
  )
}
