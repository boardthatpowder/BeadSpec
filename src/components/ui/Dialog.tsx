import { forwardRef, type ComponentPropsWithoutRef, type ElementRef, type HTMLAttributes } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { cn } from '../../lib/cn'

const Root = DialogPrimitive.Root
const Trigger = DialogPrimitive.Trigger
const Close = DialogPrimitive.Close

const Content = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
    />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-hidden',
        'bg-[--color-surface] border border-[--color-border] rounded-xl shadow-2xl text-[--color-fg]',
        'focus-visible:outline-none',
        className,
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
))
Content.displayName = 'Dialog.Content'

function Header({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <DialogPrimitive.Title asChild>
      <div
        className={cn('border-b border-[--color-border] px-5 py-4 text-base font-semibold text-[--color-fg]', className)}
        {...props}
      />
    </DialogPrimitive.Title>
  )
}

function Body({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <DialogPrimitive.Description asChild>
      <div className={cn('px-5 py-4 text-sm text-[--color-fg-muted]', className)} {...props} />
    </DialogPrimitive.Description>
  )
}

function Footer({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex items-center justify-end gap-2 border-t border-[--color-border] px-5 py-4',
        className,
      )}
      {...props}
    />
  )
}

export const Dialog = {
  Root,
  Trigger,
  Content,
  Header,
  Body,
  Footer,
  Close,
}
