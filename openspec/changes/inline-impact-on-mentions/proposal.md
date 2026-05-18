## Why

Issue descriptions routinely reference code symbols — `` `lookup_symbols` ``, `DescriptionEditor`, `do_thing` — but the reader today has to context-switch to GitNexus tools or the upcoming Impact tab to understand the blast radius of touching those symbols. Surfacing a 3-line hover summary (qualified path · risk badge · top callers) directly in the description editor collapses that loop and reinforces the "check impact before editing" discipline at exactly the moment an author or reviewer is reasoning about a change. It builds naturally on the `description-markdown-editor` change (which introduces the Tiptap markdown round-trip) and deep-links into the `gitnexus-impact-panel` change (which adds the Impact sub-tab).

## What Changes

- `DescriptionEditor` SHALL render a non-persisted Tiptap mark (`SymbolMentionMark`) over tokens detected by a tokenizer pass applied after content load and on every editor transaction (debounced 300 ms).
- Token detection priority:
  1. Text inside inline-code backtick runs.
  2. CamelCase identifiers ≥ 3 characters with at least one internal lowercase→uppercase boundary.
  3. snake_case identifiers with at least one underscore and total length > 4.
  Tokens shorter than 3 chars or present in a built-in stoplist SHALL NOT be decorated.
- A new Tauri command `lookup_symbols(project_path, names: Vec<String>) -> Vec<Option<SymbolHit>>` SHALL return, per input name, an optional `SymbolHit { name, qualified_path, kind, one_line_description, risk_level, top_upstream_callers: Vec<CallerRef> }` or `None` when GitNexus has no match. Lookups are debounced and batched per editor instance.
- On hover over a decorated mark, a Radix `Popover` SHALL render the symbol's qualified path, 1-line description, risk badge (same palette as `gitnexus-impact-panel`), up to 3 upstream callers, and an "Open full impact" CTA.
- The CTA SHALL switch the parent `TaskDetailPanel` to its Impact inner sub-tab with the symbol pre-selected, using the state contract supplied by `gitnexus-impact-panel`.
- Tokens with no GitNexus match SHALL render as plain text — no decoration, no popover.
- The mark SHALL be a ProseMirror `DecorationSet` (render-only); it SHALL NOT be persisted. `editor.storage.markdown.getMarkdown()` output SHALL be byte-identical with and without the extension loaded.

Non-goals:
- No write path — hovering or clicking a mention does not modify the issue.
- No multi-repo lookup — `project_path` is the active workspace only.
- No fuzzy matching — exact name match against the GitNexus index.
- No GitNexus index-freshness UI (covered by `gitnexus-index-freshness-badge`).
- No decoration support for the `CommentsSection` editor (separate Tiptap instance; follow-up if desired).

## Capabilities

### New Capabilities
<!-- None — this extends an existing capability. -->

### Modified Capabilities
- `task-detail`: adds a new inline symbol-mention decoration requirement to the description editor.

## Impact

- **Tauri command** (new): `lookup_symbols` in `src-tauri/src/commands/gitnexus_symbols.rs`. New types `SymbolHit`, `CallerRef`, `RiskLevel` derived with `specta::Type`.
- **Type bindings**: new types auto-generated into `src/bindings.ts` via `specta` / `tauri-specta`.
- **Frontend IPC**: new `lookupSymbols(projectPath, names)` wrapper in `src/ipc.ts`.
- **Tiptap extension**: `src/components/task-detail/SymbolMentionMark.ts` — ProseMirror plugin with `DecorationSet` and in-memory LRU cache (size 200).
- **React component**: `src/components/task-detail/SymbolMentionPopover.tsx` for popover content.
- **`DescriptionEditor.tsx`**: loads the extension, wires the debounced lookup hook, and mounts the popover portal.
- **No schema changes** — no Dolt tables touched.
- **No CLI shellouts from the frontend** — symbol lookups go via the Tauri command.
