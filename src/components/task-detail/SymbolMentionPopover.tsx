import type { SymbolHit } from '../../bindings'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'

const RISK_CLASS: Record<string, string> = {
  Low: 'bg-(--color-surface-hi) text-(--color-fg-muted) border-(--color-border-strong)',
  Medium: 'bg-amber-950/40 text-amber-300 border-amber-800/50',
  High: 'bg-orange-950/50 text-orange-300 border-orange-800/50',
  Critical: 'bg-red-950/60 text-red-300 border-red-800/50',
  Unknown: 'bg-(--color-surface) text-(--color-fg-subtle) border-(--color-border)',
}

export function SymbolMentionPopover({
  hit,
  onOpenImpact,
}: {
  hit: SymbolHit
  onOpenImpact: (symbol: string) => void
}) {
  return (
    <div className="w-80 rounded-lg border border-(--color-border-strong) bg-(--color-bg) p-3 shadow-xl">
      <div className="font-mono text-xs text-(--color-fg-muted)">{hit.qualified_path}</div>
      <div className="mt-1 text-sm text-(--color-fg)">{hit.one_line_description}</div>
      <div className="mt-2 flex items-center gap-2">
        <span className={`rounded border px-2 py-0.5 text-[10px] ${RISK_CLASS[hit.risk_level] ?? RISK_CLASS.Unknown}`}>
          {hit.risk_level}
        </span>
        <span className="text-[10px] text-(--color-fg-subtle)">{hit.kind}</span>
      </div>
      {hit.top_upstream_callers.length > 0 && (
        <div className="mt-2 space-y-1">
          {hit.top_upstream_callers.slice(0, 3).map(caller => (
            <div key={`${caller.name}-${caller.qualified_path}`} className="text-xs">
              <span className="text-(--color-fg-muted)">{caller.name}</span>
              <span className="ml-2 font-mono text-(--color-fg-subtle)">{caller.qualified_path}</span>
            </div>
          ))}
        </div>
      )}
      <Button
        variant="link"
        size="xs"
        onClick={() => onOpenImpact(hit.name)}
        trailingIcon={<Icon name="ArrowRight" size="sm" />}
        className="mt-3 h-auto px-0 py-0 text-xs text-blue-400 hover:text-blue-300"
      >
        Open full impact
      </Button>
    </div>
  )
}
