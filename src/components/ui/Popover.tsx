import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { cn } from '../../lib/cn'

const Root = PopoverPrimitive.Root
const Trigger = PopoverPrimitive.Trigger

const Content = forwardRef<
  ElementRef<typeof PopoverPrimitive.Content>,
  ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      forceMount
      sideOffset={sideOffset}
      className={cn(
        'z-50 rounded-lg border border-(--color-border) bg-(--color-surface) text-(--color-fg) shadow-xl',
        'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-2',
        'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2',
        'duration-150 motion-reduce:animate-none motion-reduce:transition-none',
        'focus-visible:outline-none',
        className,
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
))
Content.displayName = 'Popover.Content'

export const Popover = {
  Root,
  Trigger,
  Content,
}
