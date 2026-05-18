import { forwardRef, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '../../lib/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link'
export type ButtonSize = 'xs' | 'sm' | 'md'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  leadingIcon?: ReactNode
  trailingIcon?: ReactNode
  loading?: boolean
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'border-transparent bg-(--color-accent) text-(--color-accent-fg) hover:bg-blue-600',
  secondary: 'border-(--color-border) bg-(--color-surface-hi) text-(--color-fg) hover:bg-(--color-surface-hi)',
  ghost: 'border-transparent bg-transparent text-(--color-fg-muted) hover:bg-(--color-surface-hi) hover:text-(--color-fg)',
  danger: 'border-transparent bg-(--color-danger) text-white hover:bg-red-600',
  link: 'border-transparent bg-transparent px-0 text-(--color-accent) underline-offset-4 hover:underline',
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  xs: 'h-7 px-2 text-xs',
  sm: 'h-8 px-3 text-sm',
  md: 'h-9 px-4 text-sm',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'secondary',
      size = 'md',
      leadingIcon,
      trailingIcon,
      loading = false,
      disabled,
      className,
      children,
      type = 'button',
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        className={cn(
          'inline-flex items-center justify-center gap-1.5 rounded-md border font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent) focus-visible:ring-offset-1 focus-visible:ring-offset-(--color-bg)',
          'disabled:opacity-50 disabled:pointer-events-none',
          VARIANT_CLASSES[variant],
          SIZE_CLASSES[size],
          className,
        )}
        {...props}
      >
        {loading ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={1.5} /> : leadingIcon}
        {children}
        {!loading && trailingIcon}
      </button>
    )
  },
)

Button.displayName = 'Button'
