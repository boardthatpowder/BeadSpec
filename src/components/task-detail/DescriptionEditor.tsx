import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { Extension } from '@tiptap/core'
import { Markdown } from 'tiptap-markdown'
import DOMPurify from 'dompurify'
import { useState, useCallback, useRef } from 'react'
import { commands, unwrap } from '../../ipc'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '../ui/Toast'
import { usePendingEdits } from '../../hooks/usePendingEdits'
import { SlashMenu } from './SlashMenu'
import { TaskPickerModal } from './TaskPickerModal'
import { EDITOR_CLASSES } from '../shared/proseMirrorClasses'
import { SymbolMentionMark } from './SymbolMentionMark'
import { SymbolMentionPopover } from './SymbolMentionPopover'
import type { SymbolHit } from '../../bindings'

interface Props {
  taskId: string
  project: string
  initialContent: string | null
  onOpenImpact?: (symbol: string) => void
}

// tiptap-markdown doesn't augment Tiptap v3's Storage type — cast required.
const markdownStorage = (storage: unknown) =>
  (storage as { markdown: { getMarkdown: () => string } }).markdown

/** Extension that fires a callback when '/' is typed at the start of a word */
function createSlashDetector(onSlash: () => void) {
  return Extension.create({
    name: 'slashDetector',
    addKeyboardShortcuts() {
      return {
        '/': () => {
          onSlash()
          return false // let the '/' character still be inserted
        },
      }
    },
  })
}

export function DescriptionEditor({ taskId, project, initialContent, onOpenImpact }: Props) {
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(initialContent ?? '')
  const savedRef = useRef(saved)
  savedRef.current = saved
  const [isDirty, setIsDirty] = useState(false)
  const [slashOpen, setSlashOpen] = useState(false)
  const [showTaskPicker, setShowTaskPicker] = useState(false)
  const [symbolPopover, setSymbolPopover] = useState<{ hit: SymbolHit; x: number; y: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const queryClient = useQueryClient()
  const { toast } = useToast()
  const setHasPendingEdits = usePendingEdits(s => s.setHasPendingEdits)

  const slashOpenRef = useRef(slashOpen)
  slashOpenRef.current = slashOpen

  const editor = useEditor({
    extensions: [
      StarterKit,
      Markdown.configure({ html: false }),
      TaskList,
      TaskItem.configure({ nested: true }),
      SymbolMentionMark.configure({
        projectPath: project,
        lookupSymbols: names => unwrap(commands.lookupSymbols(project, names)),
      }),
      createSlashDetector(() => {
        // Small delay so the '/' character is inserted before we open the menu
        setTimeout(() => setSlashOpen(true), 0)
      }),
    ],
    // Content is loaded in onCreate so both markdown and legacy HTML are handled.
    content: '',
    onCreate: ({ editor: ed }) => {
      const content = initialContent ?? ''
      if (content) {
        // tiptap-markdown parses markdown strings. Legacy HTML descriptions
        // (saved by older UI versions) are treated as HTML blocks (html:true default)
        // and passed through; getMarkdown() then normalises the baseline so the
        // dirty check works consistently regardless of original storage format.
        // DOMPurify sanitizes any HTML before handing it to the editor (defense-in-depth).
        ed.commands.setContent(DOMPurify.sanitize(content))
      }
      const baseline = markdownStorage(ed.storage).getMarkdown()
      setSaved(baseline)
      savedRef.current = baseline
      setIsDirty(false)
      setHasPendingEdits(false)
    },
    editable: editing,
    onBlur: () => {
      // Don't save if slash menu is open (user is choosing a command)
      if (!slashOpenRef.current) handleSave()
    },
    onUpdate: ({ editor: ed }) => {
      const markdown = markdownStorage(ed.storage).getMarkdown()
      const dirty = markdown !== savedRef.current
      setIsDirty(dirty)
      setHasPendingEdits(dirty)
    },
  }, [editing, taskId, project])

  const handleSave = useCallback(async () => {
    if (!editor) return
    const markdown = markdownStorage(editor.storage).getMarkdown()
    if (markdown === saved) {
      setEditing(false)
      setIsDirty(false)
      setHasPendingEdits(false)
      return
    }
    try {
      await unwrap(commands.updateTaskField(project, taskId, 'description', markdown))
      setSaved(markdown)
      setIsDirty(false)
      setHasPendingEdits(false)
      queryClient.setQueryData(['task', project, taskId], (old: any) =>
        old ? { ...old, description: markdown } : old
      )
    } catch (e) {
      toast(`Failed to save: ${e}`)
      editor.commands.setContent(DOMPurify.sanitize(saved))
    } finally {
      setEditing(false)
    }
  }, [editor, saved, project, taskId, queryClient, toast, setHasPendingEdits])

  const handleDiscard = useCallback(() => {
    editor?.commands.setContent(DOMPurify.sanitize(saved))
    setEditing(false)
    setIsDirty(false)
    setHasPendingEdits(false)
    setSlashOpen(false)
  }, [editor, saved, setHasPendingEdits])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (slashOpen) {
        setSlashOpen(false)
        return
      }
      handleDiscard()
    }
  }

  const handleSlashSelect = useCallback((id: string) => {
    if (!editor) return
    setSlashOpen(false)
    // Delete the '/' that was just typed, then apply the command
    const { state } = editor
    const { from } = state.selection
    const range = { from: from - 1, to: from }
    switch (id) {
      case 'heading':
        editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run()
        break
      case 'code':
        editor.chain().focus().deleteRange(range).setCodeBlock().run()
        break
      case 'checklist':
        editor.chain().focus().deleteRange(range).toggleTaskList().run()
        break
      case 'quote':
        editor.chain().focus().deleteRange(range).setBlockquote().run()
        break
    }
  }, [editor])

  const handlePointerEnter = useCallback(async (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    const mention = target.closest<HTMLElement>('.symbol-mention')
    const symbol = mention?.dataset.symbol
    if (!symbol) return
    try {
      const [hit] = await unwrap(commands.lookupSymbols(project, [symbol]))
      if (!hit) return
      const rect = mention.getBoundingClientRect()
      setSymbolPopover({ hit, x: rect.left, y: rect.bottom + 6 })
    } catch {
      setSymbolPopover(null)
    }
  }, [project])

  const ringClass = editing && isDirty
    ? 'ring-amber-500/30 ring-1'
    : editing
    ? 'ring-blue-500/20 ring-1'
    : ''

  return (
    <div
      ref={containerRef}
      onClick={() => !editing && setEditing(true)}
      onKeyDown={handleKeyDown}
      onPointerOver={handlePointerEnter}
      onPointerLeave={() => setSymbolPopover(null)}
      className={[
        'min-h-16 rounded-lg p-3 transition-colors cursor-text relative',
        editing
          ? `bg-neutral-800 border ${isDirty ? 'border-amber-500/50' : 'border-blue-500/50'} ${ringClass}`
          : 'hover:bg-neutral-800/50 border border-transparent',
      ].join(' ')}
    >
      {(!saved && !editing) ? (
        <p className="text-sm text-neutral-600 italic">Click to add description…</p>
      ) : (
        <div className="relative">
          <EditorContent
            editor={editor}
            className={`${EDITOR_CLASSES} [&_.ProseMirror]:min-h-12`}
          />
          {editing && slashOpen && (
            <SlashMenu
              onSelect={handleSlashSelect}
              onClose={() => setSlashOpen(false)}
              onTask={() => { setSlashOpen(false); setShowTaskPicker(true) }}
            />
          )}
        </div>
      )}
      {editing && isDirty && (
        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-500/70" title="Unsaved changes" />
      )}
      {showTaskPicker && (
        <TaskPickerModal
          onClose={() => setShowTaskPicker(false)}
          onSelect={(t) => {
            editor?.chain().focus().insertContent(`[${t.id}: ${t.title}]`).run()
            setShowTaskPicker(false)
          }}
        />
      )}
      {symbolPopover && (
        <div
          className="fixed z-50"
          style={{ left: symbolPopover.x, top: symbolPopover.y }}
          onPointerEnter={() => setSymbolPopover(symbolPopover)}
          onPointerLeave={() => setSymbolPopover(null)}
        >
          <SymbolMentionPopover
            hit={symbolPopover.hit}
            onOpenImpact={(symbol) => {
              onOpenImpact?.(symbol)
              setSymbolPopover(null)
            }}
          />
        </div>
      )}
    </div>
  )
}
