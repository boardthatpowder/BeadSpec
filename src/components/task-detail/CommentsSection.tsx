import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { commands, unwrap } from '../../ipc'
import type { HistoryEntry } from '../../bindings'
import { useToast } from '../ui/Toast'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'

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
    <div className="mt-4 pt-4 border-t border-neutral-800">
      <div className="text-xs text-neutral-500 uppercase tracking-wider mb-3">Comments</div>

      {comments.length === 0 && (
        <p className="text-sm text-neutral-600 italic mb-3">No comments yet</p>
      )}

      {comments.map(c => (
        <div key={c.id} className="flex gap-3 mb-3">
          <div className="w-6 h-6 rounded-full bg-neutral-700 flex-shrink-0 flex items-center justify-center text-xs text-neutral-300 font-medium">
            {c.actor?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-xs font-medium text-neutral-300">{c.actor}</span>
              <span className="text-xs text-neutral-600">
                {new Date(c.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
            </div>
            <div className="text-sm text-neutral-300 whitespace-pre-wrap leading-relaxed bg-neutral-800/50 rounded-lg px-3 py-2">
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
          className="relative flex-1 min-h-12 max-h-32 overflow-y-auto bg-neutral-800 border border-neutral-700 focus-within:border-blue-500 rounded-lg px-3 py-2 text-sm text-neutral-200 cursor-text transition-colors"
        >
          <EditorContent editor={editor} />
          {editor?.isEmpty && (
            <div className="text-neutral-600 pointer-events-none absolute top-2 left-3">
              Add a comment… (⌘Enter to submit)
            </div>
          )}
        </div>
        <button
          onClick={submit}
          disabled={submitting || !editor || editor.isEmpty}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs rounded-lg transition-colors self-end"
        >
          {submitting ? '…' : 'Send'}
        </button>
      </div>
    </div>
  )
}
