import type { WorkflowViewHelp } from './workflowViewHelp'

export function ViewHelpHeader({ help }: { help: WorkflowViewHelp }) {
  return (
    <header className="border-b border-[--color-border] bg-[--color-bg]/80 px-5 py-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[--color-fg]">{help.title}</div>
          <p className="mt-1 max-w-4xl text-sm leading-5 text-[--color-fg-subtle]">{help.description}</p>
        </div>
        <span className="shrink-0 rounded border border-[--color-border] px-2 py-0.5 text-[10px] uppercase text-[--color-fg-subtle]">
          Help
        </span>
      </div>
    </header>
  )
}
