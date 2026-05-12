import { useQuery } from '@tanstack/react-query'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'
import { readChangeArtifact } from '../../ipc'
import { useActiveProject } from '../../hooks/useProject'
import { EDITOR_CLASSES } from '../shared/proseMirrorClasses'

interface OpenSpecDocPanelProps {
  change: string
  artifact: string
}

export function OpenSpecDocPanel({ change, artifact }: OpenSpecDocPanelProps) {
  const projectPath = useActiveProject()

  const { data: content, isLoading, isError } = useQuery({
    queryKey: ['openspec-doc', projectPath, change, artifact],
    queryFn: () => readChangeArtifact(projectPath ?? '', change, artifact),
    enabled: !!projectPath,
  })

  const editor = useEditor({
    extensions: [StarterKit, Markdown.configure({ html: false })],
    content: content ?? '',
    editable: false,
  }, [content])

  if (isLoading) return <LoadingSkeleton />
  if (isError || !content) return (
    <div className="p-6 text-sm text-neutral-500">Could not load this artifact.</div>
  )

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="text-xs text-neutral-600 mb-4 font-mono">{change}/{artifact}</div>
      <EditorContent editor={editor} className={EDITOR_CLASSES} />
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
