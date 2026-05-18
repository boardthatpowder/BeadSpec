import { useQuery } from '@tanstack/react-query'
import { useEditor, EditorContent } from '@tiptap/react'
import { useCallback, useState } from 'react'
import type { PointerEvent } from 'react'
import { commands, listChanges, readChangeArtifact, unwrap } from '../../ipc'
import { useActiveProject } from '../../hooks/useProject'
import { useWorkspaceStore } from '../../stores/workspace'
import { EDITOR_CLASSES } from '../shared/proseMirrorClasses'
import { createOpenSpecDocExtensions } from './openSpecDocExtensions'
import { buildOpenSpecDocReferences } from './openSpecDocReferences'
import { SymbolMentionPopover } from '../task-detail/SymbolMentionPopover'
import type { ChangeInfo, SymbolHit } from '../../bindings'
import type { OpenSpecDocReference } from './openSpecDocReferences'
import { Button } from '../ui/Button'

interface OpenSpecDocPanelProps {
  change: string
  artifact: string
}

export function OpenSpecDocPanel({ change, artifact }: OpenSpecDocPanelProps) {
  const projectPath = useActiveProject()
  const openDocTab = useWorkspaceStore((s) => s.openDocTab)
  const [symbolPopover, setSymbolPopover] = useState<{ hit: SymbolHit; x: number; y: number } | null>(null)

  const { data: content, isLoading, isError } = useQuery({
    queryKey: ['openspec-doc', projectPath, change, artifact],
    queryFn: () => readChangeArtifact(projectPath ?? '', change, artifact),
    enabled: !!projectPath,
  })
  const { data: changes } = useQuery<ChangeInfo[]>({
    queryKey: ['openspec-changes', projectPath],
    queryFn: () => listChanges(projectPath ?? ''),
    enabled: !!projectPath,
    staleTime: 60_000,
  })
  const changeInfo = changes?.find((candidate) => (
    candidate.name === change || candidate.slug === change
  ))
  const docReferences = buildOpenSpecDocReferences(changeInfo, artifact)

  const editor = useEditor({
    extensions: createOpenSpecDocExtensions(projectPath ?? ''),
    content: content ?? '',
    editable: false,
  }, [content, projectPath])

  const handlePointerEnter = useCallback(async (e: PointerEvent<HTMLDivElement>) => {
    if (!projectPath) return
    const target = e.target as HTMLElement
    const mention = target.closest<HTMLElement>('.symbol-mention')
    const symbol = mention?.dataset.symbol
    if (!symbol) return
    try {
      const [hit] = await unwrap(commands.lookupSymbols(projectPath, [symbol]))
      if (!hit) return
      const rect = mention.getBoundingClientRect()
      setSymbolPopover({ hit, x: rect.left, y: rect.bottom + 6 })
    } catch {
      setSymbolPopover(null)
    }
  }, [projectPath])

  if (isLoading) return <LoadingSkeleton />
  if (isError || !content) return (
    <div className="p-6 text-sm text-(--color-fg-subtle)">Could not load this artifact.</div>
  )

  return (
    <div
      className="h-full overflow-y-auto p-6"
      onPointerOver={handlePointerEnter}
      onPointerLeave={() => setSymbolPopover(null)}
    >
      <div className="text-xs text-(--color-fg-subtle) mb-4 font-mono">{change}/{artifact}</div>
      <OpenSpecDocReferenceNav
        references={docReferences}
        onOpen={(nextArtifact) => openDocTab(change, nextArtifact)}
      />
      <EditorContent editor={editor} className={EDITOR_CLASSES} />
      {symbolPopover && (
        <div
          className="fixed z-50"
          style={{ left: symbolPopover.x, top: symbolPopover.y }}
          onPointerEnter={() => setSymbolPopover(symbolPopover)}
          onPointerLeave={() => setSymbolPopover(null)}
        >
          <SymbolMentionPopover hit={symbolPopover.hit} onOpenImpact={() => {}} />
        </div>
      )}
    </div>
  )
}

function OpenSpecDocReferenceNav({
  references,
  onOpen,
}: {
  references: OpenSpecDocReference[]
  onOpen: (artifact: string) => void
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-1.5 border-b border-(--color-border)/70 pb-3">
      <span className="mr-1 text-xs text-(--color-fg-subtle)">Docs</span>
      {references.map((reference) => {
        const baseClass = [
          'rounded border px-2 py-1 text-xs transition-colors',
          reference.current
            ? 'border-blue-500/50 bg-blue-500/10 text-blue-200'
            : reference.present
              ? 'border-(--color-border-strong) text-(--color-fg-muted) hover:border-neutral-500 hover:bg-(--color-surface-hi)/60 hover:text-(--color-fg)'
              : 'cursor-not-allowed border-(--color-border) text-(--color-fg-subtle) opacity-60',
        ].join(' ')

        if (reference.current || !reference.present) {
          return (
            <span
              key={reference.artifact}
              aria-current={reference.current ? 'page' : undefined}
              className={baseClass}
            >
              {reference.label}
            </span>
          )
        }

        return (
          <Button
            key={reference.artifact}
            variant="ghost"
            size="xs"
            type="button"
            onClick={() => onOpen(reference.artifact)}
            className={baseClass}
          >
            {reference.label}
          </Button>
        )
      })}
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="p-6 space-y-3 animate-pulse">
      {[80, 60, 90, 50, 70].map((w, i) => (
        <div key={i} className="h-3 bg-(--color-surface-hi) rounded" style={{ width: `${w}%` }} />
      ))}
    </div>
  )
}
