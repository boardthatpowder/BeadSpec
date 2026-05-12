import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react'
import { useHumanQueue, HumanQueueItem } from '../../hooks/useHumanQueue'
import { useAppState } from '../../contexts/HashStateContext'
import { IconButton } from '../ui/IconButton'

// ─── Chip ────────────────────────────────────────────────────────────────────

export function BdHumanQueueChip() {
  const { items } = useHumanQueue()
  const [open, setOpen] = useState(false)

  if (items.length === 0) return null

  return (
    <div className="relative flex-shrink-0">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-medium hover:bg-amber-500/30 transition-colors"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        {items.length} {items.length === 1 ? 'decision' : 'decisions'}
      </button>

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
      className="absolute top-full right-0 mt-2 w-96 max-h-[480px] overflow-y-auto rounded-xl border border-neutral-700 bg-neutral-900 shadow-2xl z-50"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 sticky top-0 bg-neutral-900">
        <span className="text-sm font-semibold text-neutral-100">Pending decisions</span>
        <IconButton
          label="Close"
          onClick={onClose}
          className="text-neutral-500 hover:text-neutral-300 transition-colors text-lg leading-none"
        >
          ×
        </IconButton>
      </div>

      {/* Items or empty state */}
      {items.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-neutral-500">
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
      <div className="text-sm font-semibold text-neutral-100">{item.title}</div>

      {/* Prompt */}
      <div className="text-xs text-neutral-400 leading-relaxed whitespace-pre-wrap">{item.prompt}</div>

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
            className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-neutral-800 border border-neutral-600 text-neutral-100 placeholder-neutral-500 resize-none focus:outline-none focus:border-amber-500/60"
          />
          <div className="flex gap-2">
            <button
              onClick={onRespondSubmit}
              disabled={!respondText.trim()}
              className="px-3 py-1 text-xs rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Send
            </button>
            <button
              onClick={onRespondCancel}
              className="px-3 py-1 text-xs rounded-md text-neutral-400 hover:text-neutral-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {!isResponding && (
        <div className="flex items-center gap-2 mt-0.5">
          <button
            onClick={onRespondOpen}
            className="px-2.5 py-1 text-xs rounded-md bg-neutral-800 border border-neutral-700 text-neutral-300 hover:border-amber-500/50 hover:text-amber-300 transition-colors"
          >
            Respond
          </button>
          <button
            onClick={onDismiss}
            className="px-2.5 py-1 text-xs rounded-md bg-neutral-800 border border-neutral-700 text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            Dismiss
          </button>
          <button
            onClick={onViewIssue}
            className="px-2.5 py-1 text-xs rounded-md text-neutral-500 hover:text-neutral-300 transition-colors ml-auto"
          >
            View issue →
          </button>
        </div>
      )}
    </div>
  )
}
