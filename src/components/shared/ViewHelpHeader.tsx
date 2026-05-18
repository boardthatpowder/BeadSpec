import type { WorkflowViewHelp } from './workflowViewHelp'

export function ViewHelpHeader({ help }: { help: WorkflowViewHelp }) {
  return (
    <header className="border-b border-neutral-800 bg-neutral-950/80 px-5 py-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-neutral-100">{help.title}</div>
          <p className="mt-1 max-w-4xl text-sm leading-5 text-neutral-500">{help.description}</p>
        </div>
        <span className="shrink-0 rounded border border-neutral-800 px-2 py-0.5 text-[10px] uppercase text-neutral-500">
          Help
        </span>
      </div>
    </header>
  )
}
