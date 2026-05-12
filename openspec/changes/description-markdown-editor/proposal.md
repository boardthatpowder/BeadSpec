## Why

The `bd` CLI stores issue descriptions as plain markdown, but `DescriptionEditor` feeds that string to Tiptap as HTML, causing line breaks to collapse and markdown syntax (bold, lists, code fences) to render literally. The editor also persists `editor.getHTML()` back to storage, creating a growing format mismatch between CLI-created and UI-edited descriptions.

## What Changes

- Install `tiptap-markdown` extension
- `DescriptionEditor` parses `initialContent` as markdown on load (instead of treating it as HTML)
- `DescriptionEditor` serializes via `editor.storage.markdown.getMarkdown()` on save (replaces `editor.getHTML()`)
- Graceful coexistence: descriptions that begin with `<` are treated as legacy HTML and passed through to Tiptap unchanged, preserving any content already saved by the UI
- No changes to the Rust/Tauri layer — description storage is opaque there

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `task-detail`: requirement that the description field round-trips as markdown rather than HTML; editor must parse markdown on load and serialize markdown on save

## Impact

- `src/components/task-detail/DescriptionEditor.tsx` — load and save paths
- `package.json` / `bun.lockb` — new dependency (`tiptap-markdown`)
- Out of scope: `CommentsSection.tsx`, notes/design/acceptance fields (not surfaced from Tauri backend)
