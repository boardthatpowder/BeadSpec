import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '../../lib/cn'

const Root = TabsPrimitive.Root

const List = forwardRef<
  ElementRef<typeof TabsPrimitive.List>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn('flex items-center gap-3 border-b border-[--color-border]', className)}
    {...props}
  />
))
List.displayName = 'Tabs.List'

const Trigger = forwardRef<
  ElementRef<typeof TabsPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'border-b-2 border-transparent px-1 pb-2 pt-1 text-sm text-[--color-fg-muted] transition-colors',
      'data-[state=active]:border-[--color-accent] data-[state=active]:text-[--color-fg]',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-accent] focus-visible:ring-offset-1 focus-visible:ring-offset-[--color-bg]',
      className,
    )}
    {...props}
  />
))
Trigger.displayName = 'Tabs.Trigger'

const Content = forwardRef<
  ElementRef<typeof TabsPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn('focus-visible:outline-none', className)}
    {...props}
  />
))
Content.displayName = 'Tabs.Content'

export const Tabs = {
  Root,
  List,
  Trigger,
  Content,
}
