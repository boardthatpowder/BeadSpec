import { forwardRef } from 'react'
import { cn } from '../../lib/cn'
import { Tooltip } from './Tooltip'

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  shortcut?: string
  description?: string
}

const focusClasses = 'focus-visible:ring-2 focus-visible:ring-(--color-accent) focus-visible:ring-offset-1 focus-visible:ring-offset-(--color-bg)'

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, shortcut, description, children, className, ...rest }, ref) => {
    if (rest.disabled) {
      return (
        <button ref={ref} aria-label={label} className={cn(focusClasses, className)} {...rest}>
          {children}
        </button>
      )
    }
    return (
      <Tooltip label={label} shortcut={shortcut} description={description}>
        <button ref={ref} aria-label={label} className={cn(focusClasses, className)} {...rest}>
          {children}
        </button>
      </Tooltip>
    )
  }
)
IconButton.displayName = 'IconButton'
