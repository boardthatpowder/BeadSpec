import { forwardRef } from 'react'
import { cn } from '../../lib/cn'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ interactive = false, className, tabIndex, ...props }, ref) => (
    <div
      ref={ref}
      tabIndex={interactive && tabIndex === undefined ? 0 : tabIndex}
      className={cn(
        'rounded-lg border border-(--color-border) bg-(--color-surface) text-(--color-fg)',
        interactive &&
          'cursor-pointer transition-colors hover:bg-(--color-surface-hi) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)',
        className,
      )}
      {...props}
    />
  ),
)

Card.displayName = 'Card'
