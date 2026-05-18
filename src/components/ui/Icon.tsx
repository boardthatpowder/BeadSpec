import * as LucideIcons from 'lucide-react'
import type { LucideIcon, LucideProps } from 'lucide-react'

export type IconSize = 'sm' | 'md' | 'lg'
export type IconName = keyof typeof LucideIcons

export interface IconProps extends Omit<LucideProps, 'ref' | 'size'> {
  name: IconName
  size?: IconSize
}

const ICON_SIZES: Record<IconSize, number> = {
  sm: 14,
  md: 16,
  lg: 20,
}

const icons = LucideIcons as unknown as Record<IconName, LucideIcon>

export function Icon({ name, size = 'md', strokeWidth = 1.5, className, ...props }: IconProps) {
  const Component = icons[name]
  if (!Component) return null

  return (
    <Component
      aria-hidden={props['aria-label'] ? undefined : true}
      className={className}
      size={ICON_SIZES[size]}
      strokeWidth={strokeWidth}
      {...props}
    />
  )
}
