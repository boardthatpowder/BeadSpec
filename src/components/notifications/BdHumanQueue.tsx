import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react'
import { useHumanQueue, HumanQueueItem } from '../../hooks/useHumanQueue'
import { useAppState } from '../../contexts/HashStateContext'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'

// ─── Chip ────────────────────────────────────────────────────────────────────

export function BdHumanQueueChip() {
  const { items } = useHumanQueue()
  const [open, setOpen] = useState(false)

  if (items.length === 0) return null

  return (
    <div className="relative flex-shrink-0" aria-live="polite" aria-label={`${items.length} issues awaiting human review`}>
      <Button
        variant="ghost"
        size="xs"
        onClick={() => setOpen(v => !v)}
        className="h-auto rounded-full border-amber-500/40 bg-amber-500/20 px-2.5 py-1 text-amber-300 hover:bg-amber-500/30"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        {items.length} {items.length === 1 ? 'decision' : 'decisions'}
      </Button>

      {open && (
        <BdHumanQueuePopover
          items={items}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}

// ─── Popover ─────────────────────────────────────────────────────────────────

interface PopoverProps {
  items: HumanQueueItem[]
  onClose: () => void
}

function BdHumanQueuePopover({ items, onClose }: PopoverProps) {
  const { respond, dismiss } = useHumanQueue()
  const { setState } = useAppState()
  const popoverRef = useRef<HTMLDivElement>(null)

  // Keyed by item.id — holds the current text of an open respond input
  const [respondingId, setRespondingId] = useState<string | null>(null)
  const [respondText, setRespondText] = useState('')

  // Outside-click close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const handleRespondOpen = useCallback((id: string) => {
    setRespondingId(id)
    setRespondText('')
  }, [])

  const handleRespondCancel = useCallback(() => {
    setRespondingId(null)
    setRespondText('')
  }, [])

  const handleRespondSubmit = useCallback(async (id: string) => {
    const text = respondText.trim()
    if (!text) return
    setRespondingId(null)
    setRespondText('')
    await respond(id, text)
  }, [respond, respondText])

  const handleRespondKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>, id: string) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleRespondSubmit(id)
    } else if (e.key === 'Escape') {
      handleRespondCancel()
    }
  }, [handleRespondSubmit, handleRespondCancel])

  const handleViewIssue = useCallback((id: string) => {
    setState({ taskId: id.toLowerCase() })
    onClose()
  }, [setState, onClose])

  return (
    <div
      ref={popoverRef}
      className="absolute top-full right-0 mt-2 w-96 max-h-[480px] overflow-y-auto rounded-xl border border-(--color-border-strong) bg-(--color-surface) shadow-2xl z-50"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-(--color-border) sticky top-0 bg-(--color-surface)">
        <span className="text-sm font-semibold text-(--color-fg)">Pending decisions</span>
        <Button
          aria-label="Close"
          variant="ghost"
          size="xs"
          onClick={onClose}
          className="h-7 w-7 px-0 text-(--color-fg-subtle) hover:text-(--color-fg-muted)"
        >
          <Icon name="X" size="sm" />
        </Button>
      </div>

      {/* Items or empty state */}
      {items.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-(--color-fg-subtle)">
          No pending decisions
        </div>
      ) : (
        <div className="divide-y divide-neutral-800">
          {items.map(item => (
            <HumanQueueItemRow
              key={item.id}
              item={item}
              isResponding={respondingId === item.id}
              respondText={respondingId === item.id ? respondText : ''}
              onRespondTextChange={setRespondText}
              onRespondOpen={() => handleRespondOpen(item.id)}
              onRespondSubmit={() => handleRespondSubmit(item.id)}
              onRespondCancel={handleRespondCancel}
              onRespondKeyDown={(e) => handleRespondKeyDown(e, item.id)}
              onDismiss={() => dismiss(item.id)}
              onViewIssue={() => handleViewIssue(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Item Row ─────────────────────────────────────────────────────────────────

interface ItemRowProps {
  item: HumanQueueItem
  isResponding: boolean
  respondText: string
  onRespondTextChange: (text: string) => void
  onRespondOpen: () => void
  onRespondSubmit: () => void
  onRespondCancel: () => void
  onRespondKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void
  onDismiss: () => void
  onViewIssue: () => void
}

function HumanQueueItemRow({
  item,
  isResponding,
  respondText,
  onRespondTextChange,
  onRespondOpen,
  onRespondSubmit,
  onRespondCancel,
  onRespondKeyDown,
  onDismiss,
  onViewIssue,
}: ItemRowProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-focus textarea when respond mode opens
  useEffect(() => {
    if (isResponding && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [isResponding])

  return (
    <div className="px-4 py-3 flex flex-col gap-2">
      {/* Title */}
      <div className="text-sm font-semibold text-(--color-fg)">{item.title}</div>

      {/* Prompt */}
      <div className="text-xs text-(--color-fg-muted) leading-relaxed whitespace-pre-wrap">{item.prompt}</div>

      {/* Respond inline input */}
      {isResponding && (
        <div className="flex flex-col gap-1.5 mt-1">
          <textarea
            ref={textareaRef}
            rows={2}
            value={respondText}
            onChange={e => onRespondTextChange(e.target.value)}
            onKeyDown={onRespondKeyDown}
            placeholder="Type a response… (Enter to send, Shift+Enter for newline, Esc to cancel)"
            className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-(--color-surface-hi) border border-neutral-600 text-(--color-fg) placeholder-neutral-500 resize-none focus:outline-none focus:border-amber-500/60"
          />
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="xs"
              onClick={onRespondSubmit}
              disabled={!respondText.trim()}
              className="border-amber-500/40 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Send
            </Button>
            <Button
              variant="ghost"
              size="xs"
              onClick={onRespondCancel}
              className="text-(--color-fg-muted) hover:text-(--color-fg)"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {!isResponding && (
        <div className="flex items-center gap-2 mt-0.5">
          <Button
            variant="secondary"
            size="xs"
            onClick={onRespondOpen}
            className="border-(--color-border-strong) bg-(--color-surface-hi) text-(--color-fg-muted) hover:border-amber-500/50 hover:text-amber-300"
          >
            Respond
          </Button>
          <Button
            variant="secondary"
            size="xs"
            onClick={onDismiss}
            className="border-(--color-border-strong) bg-(--color-surface-hi) text-(--color-fg-muted) hover:text-(--color-fg)"
          >
            Dismiss
          </Button>
          <Button
            variant="ghost"
            size="xs"
            onClick={onViewIssue}
            className="ml-auto text-(--color-fg-subtle) hover:text-(--color-fg-muted)"
            trailingIcon={<Icon name="ArrowRight" size="sm" />}
          >
            View issue
          </Button>
        </div>
      )}
    </div>
  )
}
