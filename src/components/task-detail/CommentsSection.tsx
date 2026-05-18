import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { commands, unwrap } from '../../ipc'
import type { HistoryEntry } from '../../bindings'
import { formatAbsolute } from '../../lib/format/date'
import { useToast } from '../ui/useToast'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Button } from '../ui/Button'

interface Props { taskId: string; project: string }

export function CommentsSection({ taskId, project }: Props) {
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const editor = useEditor({
    extensions: [StarterKit],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm prose-invert max-w-none min-h-12 outline-none p-0',
      },
    },
  })

  const { data: history = [] } = useQuery<HistoryEntry[]>({
    queryKey: ['task-history', project, taskId],
    queryFn: () => unwrap(commands.getTaskHistory(project, taskId)),
    enabled: !!project && !!taskId,
    staleTime: 30_000,
  })

  const comments = history.filter(e => e.entry_type === 'comment')

  const submit = async () => {
    if (!editor || editor.isEmpty) return
    const html = editor.getText()
    setSubmitting(true)
    try {
      await unwrap(commands.addComment(project, taskId, html))
      editor.commands.clearContent()
      queryClient.invalidateQueries({ queryKey: ['task-history', project, taskId] })
    } catch (e) {
      toast(`Failed to add comment: ${e}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mt-4 pt-4 border-t border-[--color-border]">
      <div className="text-xs text-[--color-fg-subtle] uppercase tracking-wider mb-3">Comments</div>

      {comments.length === 0 && (
        <p className="text-sm text-[--color-fg-subtle] italic mb-3">No comments yet</p>
      )}

      {comments.map(c => (
        <div key={c.id} className="flex gap-3 mb-3">
          <div className="w-6 h-6 rounded-full bg-[--color-surface-hi] flex-shrink-0 flex items-center justify-center text-xs text-[--color-fg-muted] font-medium">
            {c.actor?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-xs font-medium text-[--color-fg-muted]">{c.actor}</span>
              <span className="text-xs text-[--color-fg-subtle]">
                {formatAbsolute(c.timestamp)}
              </span>
            </div>
            <div className="text-sm text-[--color-fg-muted] whitespace-pre-wrap leading-relaxed bg-[--color-surface-hi]/50 rounded-lg px-3 py-2">
              {c.body}
            </div>
          </div>
        </div>
      ))}

      {/* Composer */}
      <div className="flex gap-2 mt-2">
        <div
          onClick={() => editor?.commands.focus()}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit() }}
          className="relative flex-1 min-h-12 max-h-32 overflow-y-auto bg-[--color-surface-hi] border border-[--color-border-strong] focus-within:border-blue-500 rounded-lg px-3 py-2 text-sm text-[--color-fg] cursor-text transition-colors"
        >
          <EditorContent editor={editor} />
          {editor?.isEmpty && (
            <div className="text-[--color-fg-subtle] pointer-events-none absolute top-2 left-3">
              Add a comment… (⌘Enter to submit)
            </div>
          )}
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={submit}
          disabled={submitting || !editor || editor.isEmpty}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs rounded-lg transition-colors self-end"
        >
          {submitting ? '…' : 'Send'}
        </Button>
      </div>
    </div>
  )
}
