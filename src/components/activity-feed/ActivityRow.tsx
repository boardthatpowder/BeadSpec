import { useMemo, useState } from 'react'
import type { ActivityEvent } from '../../bindings'
import { Button } from '../ui/Button'

export function ActivityRow({ event }: { event: ActivityEvent }) {
  const [open, setOpen] = useState(false)
  const detail = useMemo(() => {
    try { return JSON.stringify(JSON.parse(event.detail), null, 2) } catch { return event.detail }
  }, [event.detail])
  return (
    <div className="rounded border border-neutral-800 bg-neutral-900/40">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(v => !v)}
        className="h-auto w-full justify-start gap-3 rounded-none border-0 px-3 py-2 text-left"
      >
        <span className="w-20 font-mono text-xs text-neutral-600">{new Date(event.ts).toLocaleTimeString()}</span>
        <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400">{event.source}</span>
        <span className="rounded bg-neutral-950 px-1.5 py-0.5 text-[10px] text-neutral-500">{event.kind}</span>
        <span className="min-w-0 truncate text-sm text-neutral-300" title={event.summary}>{event.summary}</span>
      </Button>
      {open && <pre className="max-h-72 overflow-auto border-t border-neutral-800 p-3 text-xs text-neutral-400 select-text">{detail}</pre>}
    </div>
  )
}
