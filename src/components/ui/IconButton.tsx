import { forwardRef } from 'react'
import { Tooltip } from './Tooltip'

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  shortcut?: string
  description?: string
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, shortcut, description, children, ...rest }, ref) => {
    if (rest.disabled) {
      return (
        <button ref={ref} aria-label={label} {...rest}>
          {children}
        </button>
      )
    }
    return (
      <Tooltip label={label} shortcut={shortcut} description={description}>
        <button ref={ref} aria-label={label} {...rest}>
          {children}
        </button>
      </Tooltip>
    )
  }
)
IconButton.displayName = 'IconButton'
