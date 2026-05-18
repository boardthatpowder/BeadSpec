import { useQuery } from '@tanstack/react-query'
import { useEditor, EditorContent } from '@tiptap/react'
import { useCallback, useState } from 'react'
import type { PointerEvent } from 'react'
import { commands, readChangeArtifact, unwrap } from '../../ipc'
import { useActiveProject } from '../../hooks/useProject'
import { EDITOR_CLASSES } from '../shared/proseMirrorClasses'
import { createOpenSpecDocExtensions } from './openSpecDocExtensions'
import { SymbolMentionPopover } from '../task-detail/SymbolMentionPopover'
import type { SymbolHit } from '../../bindings'

interface OpenSpecDocPanelProps {
  change: string
  artifact: string
}

export function OpenSpecDocPanel({ change, artifact }: OpenSpecDocPanelProps) {
  const projectPath = useActiveProject()
  const [symbolPopover, setSymbolPopover] = useState<{ hit: SymbolHit; x: number; y: number } | null>(null)

  const { data: content, isLoading, isError } = useQuery({
    queryKey: ['openspec-doc', projectPath, change, artifact],
    queryFn: () => readChangeArtifact(projectPath ?? '', change, artifact),
    enabled: !!projectPath,
  })

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
    <div className="p-6 text-sm text-neutral-500">Could not load this artifact.</div>
  )

  return (
    <div
      className="h-full overflow-y-auto p-6"
      onPointerOver={handlePointerEnter}
      onPointerLeave={() => setSymbolPopover(null)}
    >
      <div className="text-xs text-neutral-600 mb-4 font-mono">{change}/{artifact}</div>
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

function LoadingSkeleton() {
  return (
    <div className="p-6 space-y-3 animate-pulse">
      {[80, 60, 90, 50, 70].map((w, i) => (
        <div key={i} className="h-3 bg-neutral-800 rounded" style={{ width: `${w}%` }} />
      ))}
    </div>
  )
}
