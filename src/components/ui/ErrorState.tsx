import { Icon } from './Icon'
import { Button } from './Button'

export interface ErrorStateProps {
  title: string
  description?: string
  retry?: () => void
}

export function ErrorState({ title, description, retry }: ErrorStateProps) {
  return (
    <div className="flex min-h-48 items-center justify-center px-6 py-12 text-center">
      <div className="flex max-w-sm flex-col items-center">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-red-800/50 bg-red-950/40 text-red-300">
          <Icon name="CircleAlert" size="lg" />
        </div>
        <h3 className="text-sm font-medium text-(--color-fg)">{title}</h3>
        {description && <p className="mt-1 text-sm text-(--color-fg-muted)">{description}</p>}
        {retry && (
          <div className="mt-4">
            <Button variant="secondary" size="sm" onClick={retry}>
              Try again
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
