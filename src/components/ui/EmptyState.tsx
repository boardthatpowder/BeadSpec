import type { ReactNode } from 'react'

export interface EmptyStateProps {
  icon: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex min-h-48 items-center justify-center px-6 py-12 text-center">
      <div className="flex max-w-sm flex-col items-center">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-(--color-border) bg-(--color-surface-hi) text-(--color-fg-subtle)">
          {icon}
        </div>
        <h3 className="text-sm font-medium text-(--color-fg)">{title}</h3>
        {description && <p className="mt-1 text-sm text-(--color-fg-muted)">{description}</p>}
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  )
}
