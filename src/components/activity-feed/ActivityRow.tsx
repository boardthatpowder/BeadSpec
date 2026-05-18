import { useMemo, useState } from 'react'
import type { ActivityEvent } from '../../bindings'
import { formatRelative } from '../../lib/format/date'
import { Button } from '../ui/Button'
import { Tooltip } from '../ui/Tooltip'

export function ActivityRow({ event }: { event: ActivityEvent }) {
  const [open, setOpen] = useState(false)
  const detail = useMemo(() => {
    try { return JSON.stringify(JSON.parse(event.detail), null, 2) } catch { return event.detail }
  }, [event.detail])
  return (
    <div className="rounded border border-(--color-border) bg-(--color-surface)/40">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(v => !v)}
        className="h-auto w-full justify-start gap-3 rounded-none border-0 px-3 py-2 text-left"
      >
        <span className="w-24 font-mono text-xs text-(--color-fg-subtle)">{formatRelative(event.ts) || 'unknown'}</span>
        <span className="rounded bg-(--color-surface-hi) px-1.5 py-0.5 text-[10px] text-(--color-fg-muted)">{event.source}</span>
        <span className="rounded bg-(--color-bg) px-1.5 py-0.5 text-[10px] text-(--color-fg-subtle)">{event.kind}</span>
        <Tooltip label={event.summary}>
          <span className="min-w-0 truncate text-sm text-(--color-fg-muted)">{event.summary}</span>
        </Tooltip>
      </Button>
      {open && <pre className="max-h-72 overflow-auto border-t border-(--color-border) p-3 text-xs text-(--color-fg-muted) select-text">{detail}</pre>}
    </div>
  )
}
