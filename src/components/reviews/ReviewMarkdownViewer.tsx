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
    <div className="max-h-96 overflow-auto border-t border-neutral-800 p-3 text-sm text-neutral-400 select-text">
      <EditorContent editor={editor} className={EDITOR_CLASSES} />
    </div>
  )
}
