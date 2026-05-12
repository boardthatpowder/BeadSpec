## 1. Dependency

- [x] 1.1 Install `tiptap-markdown` via bun and verify it appears in `package.json` and `bun.lockb`

## 2. Editor Load Path

- [x] 2.1 In `DescriptionEditor.tsx`, register the `Markdown` extension from `tiptap-markdown` in the `useEditor` extensions array
- [x] 2.2 Implement legacy-HTML detection: if `initialContent` starts with `<`, load via `editor.commands.setContent(initialContent, false)` to bypass the markdown deserializer; otherwise let `tiptap-markdown` parse the string as markdown
- [ ] 2.3 Smoke-test: create a `bd` issue with a multi-line markdown description (headings, bold, code fence), open in the UI, and confirm correct rendering with no literal asterisks or collapsed whitespace

## 3. Editor Save Path

- [x] 3.1 Replace all `editor.getHTML()` calls in `DescriptionEditor.tsx` with `editor.storage.markdown.getMarkdown()`
- [ ] 3.2 Verify round-trip: edit a description in the UI, save, reload the task, and confirm formatting is preserved; also run `bd show <id>` and confirm the stored value is human-readable markdown

## 4. Extension Compatibility Check

- [ ] 4.1 Confirm `TaskList` / `TaskItem` nodes round-trip correctly (GFM `- [ ] item` syntax) — create a checklist in the editor, save, reload, and verify the checkboxes appear
- [ ] 4.2 Confirm `CodeBlockLowlight` preserves language annotations (` ```ts `) through save/load

## 5. Validation

- [ ] 5.1 Run `bun run tauri dev`, open a task created via CLI, verify description renders as formatted markdown
- [ ] 5.2 Open a task whose description was previously saved as HTML by the UI — verify it loads without corruption and can be saved again unchanged
- [ ] 5.3 Run `openspec validate --change description-markdown-editor` and confirm all checks pass
