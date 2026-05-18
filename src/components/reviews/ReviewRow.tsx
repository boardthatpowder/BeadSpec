import { useState } from 'react'
import type { ReviewEntry } from '../../bindings'
import { formatAbsolute } from '../../lib/format/date'
import { Button } from '../ui/Button'
import { ReviewMarkdownViewer } from './ReviewMarkdownViewer'

const KIND_CLASSES: Record<string, string> = {
  'pr-review': 'border-amber-900/50 bg-amber-950/30 text-amber-300',
  'code-review': 'border-slate-700 bg-slate-900/60 text-slate-300',
  'security-review': 'border-rose-900/50 bg-rose-950/30 text-rose-300',
}

function timestamp(epoch?: number | null) {
  if (!epoch) return ''
  return formatAbsolute(epoch * 1000, { includeTime: true })
}

export function ReviewRow({ review }: { review: ReviewEntry }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded border border-neutral-800 bg-neutral-950/40">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(v => !v)}
        className="flex h-auto w-full items-center justify-between gap-3 rounded-none px-3 py-2 text-left font-normal"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm text-neutral-300">{review.title}</span>
          <span className="block truncate text-[11px] text-neutral-600">
            {[review.branch, review.pr ? `PR ${review.pr}` : null, timestamp(review.ts_epoch)]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </span>
        <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] ${KIND_CLASSES[review.kind_raw] ?? 'border-neutral-700 bg-neutral-900 text-neutral-400'}`}>
          {review.kind_raw}
        </span>
      </Button>
      {open && <ReviewMarkdownViewer body={review.body} />}
    </div>
  )
}
