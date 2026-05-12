## Context

`DescriptionEditor` (Tiptap) currently calls `editor.getHTML()` on save and receives the stored string as the `content` prop on load. Tiptap treats any string passed to `content` as HTML. Descriptions created by the `bd` CLI are plain markdown; when loaded this way, whitespace collapses and markdown syntax renders literally. Descriptions edited through the UI are saved as HTML fragments, so the two formats now coexist in storage with no marker to distinguish them.

## Goals / Non-Goals

**Goals:**
- Descriptions load as markdown and are rendered correctly (headings, bold, lists, code fences, task items)
- Descriptions are saved as markdown, so `bd show <id>` output stays readable
- Descriptions already saved as HTML by the UI continue to render without corruption
- Zero Rust/Tauri changes required

**Non-Goals:**
- Migrating existing HTML-stored descriptions to markdown (graceful coexistence instead)
- Applying markdown rendering to comments (`CommentsSection.tsx`)
- Surfacing `notes`, `design`, or `acceptance` fields from the Tauri backend

## Decisions

### Decision: Use `tiptap-markdown` extension

`tiptap-markdown` adds a markdown serializer/deserializer directly to the Tiptap editor. On load it converts the markdown string to a ProseMirror document; on save `editor.storage.markdown.getMarkdown()` serializes back to markdown.

**Alternatives considered:**
- `react-markdown` (render-only): requires a separate read/edit mode toggle, introduces a format mismatch (Tiptap produces HTML on edit but the render view expects markdown). More code, same dep count.
- Replace Tiptap entirely with a dedicated markdown editor (e.g. `@uiw/react-md-editor`): loses the existing WYSIWYG UX and all the slash-command infrastructure already built.

`tiptap-markdown` keeps the existing editor surface and extension set, and makes markdown the single wire format end-to-end.

### Decision: Detect legacy HTML with a leading-`<` heuristic

Descriptions that were saved as HTML by the UI before this change need to continue rendering. On load, if `initialContent` starts with `<`, pass it to Tiptap without the markdown extension's deserializer (use `setContent(html, false)` or bypass by setting `content` directly). Otherwise parse as markdown.

**Alternatives considered:**
- One-time migration script: higher risk, requires a Tauri command or out-of-band `bd` command; any description missed would corrupt on next edit.
- Store a `content_type` field alongside the description: requires Rust/schema changes, out of scope.

The heuristic is cheap and correct for the current data — the bd CLI never starts a description with `<`, and well-formed HTML always does.

### Decision: Replace `editor.getHTML()` with `editor.storage.markdown.getMarkdown()`

All call sites that read the description for persistence (`DescriptionEditor.tsx` lines ~84, ~92) switch to the markdown serializer. No other component reads the raw description value from the editor; the Tauri backend is opaque to the format.

## Risks / Trade-offs

- **tiptap-markdown compatibility with StarterKit + TaskList + TaskItem** → The extension supports all StarterKit nodes and most common extensions. TaskList/TaskItem map to GFM task-list syntax (`- [ ] item`). Verify during implementation that round-trip fidelity is acceptable for these nodes.
- **Heuristic false positives** → A markdown description that happens to start with `<` (e.g., `<insert name here>`) would be parsed as HTML. Mitigation: acceptable edge case given real-world description content; can tighten heuristic (e.g., require `<[a-zA-Z]`) if needed.
- **`tiptap-markdown` output diverges from `bd` CLI markdown dialect** → If `bd` uses a non-standard markdown dialect (e.g., custom front-matter, special tokens), round-tripping through Tiptap could alter whitespace or formatting. Mitigation: verify with a `bd create` → open in UI → save → `bd show` test before shipping.

## Migration Plan

No data migration. The heuristic handles legacy HTML transparently on load. Descriptions that were HTML remain HTML in storage until the user edits and saves them, at which point they are re-persisted as markdown.

Rollback: revert the `tiptap-markdown` dep and the two changed call sites. Previously HTML-stored descriptions are unaffected. Any description edited after this change is deployed would need manual recovery (copy content, re-paste), but the markdown Tiptap produces is human-readable, so the risk is low.

## Open Questions

- Does `tiptap-markdown` preserve code-block language annotations (` ```ts `) through the Tiptap `CodeBlockLowlight` extension? Needs a quick smoke test during implementation.
