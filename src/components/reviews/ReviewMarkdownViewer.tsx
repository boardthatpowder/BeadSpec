import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'
import { EDITOR_CLASSES } from '../shared/proseMirrorClasses'

export function ReviewMarkdownViewer({ body }: { body: string }) {
  const editor = useEditor({
    extensions: [StarterKit, Markdown.configure({ html: false })],
    content: body,
    editable: false,
  }, [body])

  return (
    <div className="max-h-96 overflow-auto border-t border-(--color-border) p-3 text-sm text-(--color-fg-muted) select-text">
      <EditorContent editor={editor} className={EDITOR_CLASSES} />
    </div>
  )
}
