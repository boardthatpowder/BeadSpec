## Context

`DescriptionEditor.tsx` wraps Tiptap (StarterKit + TaskList/TaskItem) and, once `description-markdown-editor` lands, loads `tiptap-markdown` for round-trip serialisation. The editor sits inside `TaskDetailPanel`, which today has a tab bar containing Activity, Dependencies, and (pending `gitnexus-impact-panel`) an Impact sub-tab. No code-intelligence surface exists yet in the editor.

This change adds a render-only decoration layer that detects symbol-like tokens, validates them against the GitNexus index, and shows a hover popover with impact metadata. Two cross-change contracts must be honoured:

1. **`description-markdown-editor`**: the decoration MUST NOT touch the Tiptap document JSON or the markdown serializer output — round-trip must stay byte-identical.
2. **`gitnexus-impact-panel`**: the "Open full impact" CTA must set inner-sub-tab state that the Impact tab will read. This change ships the producer side; if the consumer has not yet landed the CTA degrades to a no-op.

## Goals / Non-Goals

**Goals:**
- Detect symbol-like tokens in description text, look them up against GitNexus, and display a hover popover for matched tokens.
- Maintain byte-identical markdown round-trip (no marks in the document, no schema changes).
- Deep-link to the Impact tab via an optional inner-sub-tab state field.
- Graceful silent degradation when GitNexus is not installed or the index is stale.
- Auto-generated TypeScript bindings via `specta` / `tauri-specta`, consistent with existing IPC patterns.

**Non-Goals:**
- No write path via the mention surface.
- No fuzzy or semantic matching — exact GitNexus name lookup only.
- No multi-repo or workspace-external lookup.
- No `CommentsSection` support (separate Tiptap instance; out of scope).
- No index-freshness UI — that is `gitnexus-index-freshness-badge`.

## Decisions

### 1. Tokenizer order: backtick > CamelCase > snake_case

Backtick-fenced runs are treated first because authors signal intent explicitly there. CamelCase detection requires at least one internal lowercase→uppercase boundary (e.g. `FooBar` matches, `FOO` and `bar` do not). snake_case requires at least one underscore and total length > 4. A built-in stoplist (maintained in the extension) rejects common React/English tokens: `useEffect`, `useState`, `onClick`, `className`, `undefined`, `boolean`, `string`, `number`, `return`, `import`, `export`, `default`, `const`, `async`, `await`, and similar. The stoplist is not user-configurable in this change.

**Alternative considered:** Regex-only pass over the serialised markdown. Rejected because it cannot distinguish backtick runs already tokenised by ProseMirror from accidental pattern matches in prose.

### 2. ProseMirror DecorationSet (not a stored mark)

The extension is a Tiptap `Extension` (not an `Extension.Mark`) that registers a ProseMirror plugin exposing a `DecorationSet`. Decorations are render-only DOM wrappers — they never enter the document JSON, which guarantees the `description-markdown-editor` round-trip stays clean. This is the same pattern used by ProseMirror's built-in selection highlight.

**Alternative considered:** A Tiptap stored mark (e.g. `SymbolMentionMark` schema node). Rejected: stored marks enter the JSON and would corrupt the markdown round-trip.

### 3. Debounce 300 ms; LRU cache size 200; TTL 5 min

Each `transaction` updates a pending-tokens set. A single 300 ms timeout flushes to `lookup_symbols`. An in-memory LRU keyed by `${projectPath}::${name}` stores the last 200 results for 5 minutes, so re-typing or scrolling does not re-fetch. The cache is per-editor instance and is not persisted to disk.

### 4. Backend `lookup_symbols` shells out to `npx gitnexus context --json <name>`

The command in `src-tauri/src/commands/gitnexus_symbols.rs` iterates over `names`, calls `gitnexus context --json <name>` per name (or reuses the client module introduced by `gitnexus-impact-panel` if that change has already landed — declared as an open question), and aggregates into `Vec<Option<SymbolHit>>`. Top 3 upstream callers are sourced from `gitnexus impact --direction upstream --limit 3 <name>`. All outputs are parsed from JSON; parse errors and missing-name responses map to `None`.

### 5. Risk badge palette aligns with `gitnexus-impact-panel`

The badge uses the same colour tokens as the `RiskBadge` component that `gitnexus-impact-panel` introduces. If that change has not yet landed, a local palette copy is used and consolidation is filed as a follow-up issue.

### 6. Popover: Radix `Popover.Root` with `Popover.Trigger asChild`

The trigger wraps the decorated span via a delegated event handler on the editor DOM (or a ProseMirror NodeView). `onOpenAutoFocus` is intercepted to keep editor focus; Tab and arrow keys still reach the CTA. The popover closes on outside-click and Escape. The portal root is the editor container to avoid z-index issues with split panes.

### 7. "Open full impact" CTA extends inner-sub-tab state

The CTA calls the existing workspace tab state setter with two new optional fields:
```
setState({ view: 'all', taskId, innerTab: 'impact', impactSymbol: qualified_path })
```
`gitnexus-impact-panel` is expected to read `innerTab` and `impactSymbol`; this change adds the producer side only. If the Impact tab is not yet registered, the state update is a no-op (the tab bar ignores unknown `innerTab` values).

### 8. Visible only when editor container is hovered or focused

Decorations are applied regardless, but the popover trigger is only reachable while the editor has hover or keyboard focus. This avoids visual noise when the description is in read-only / preview mode.

### 9. Empty-state and failure-mode handling

When `lookup_symbols` returns all-`None` for a description, zero decorations are applied and no popovers can open — no empty-state indicator is shown. When `lookup_symbols` rejects (GitNexus missing, index stale, etc.), the extension silently no-ops: a single `console.debug` fires, decorations are cleared, and the editor remains fully functional. No error banner is surfaced in the editor.

## UI Design Direction

**Register:** product — use `impeccable craft` (product register, not brand register) when implementing components.

**Aesthetic:** minimalist-utility. The decoration is a 1px dotted underline using the same neutral-blue used by existing internal link styles in the editor. The risk badge reuses the `LABEL_CHIP_COLORS` palette from `src/components/task-list/TaskListItem.tsx`. The popover is dense but legible: qualified path in monospace small, 1-line description in body-small, risk badge as a small chip, caller list as a tight bulleted row, CTA as a small text link — no large card shadow, no background gradient.

**Anti-references:** no IDE-style coloured token highlighting, no glow effects, no card-shadow inflation, no animated token underlines.

**Skills used at implementation time:** `impeccable craft` for popover composition, `impeccable audit` for diff review, `minimalist-ui` reference for internal density.

**ASCII mockup:**
```
> we should rename `lookup_symbols` to use the new client
                   ^^^^^^^^^^^^^^^^ ──┐  (1px dotted underline)
                                      │
          ┌───────────────────────────▼────────────────────────┐
          │ src-tauri/.../gitnexus_symbols.rs   [LOW risk]    │
          │ Tauri command: returns symbol hits for the editor │
          │ Called by: DescriptionEditor · TaskDetailPanel    │
          │ [Open full impact →]                              │
          └────────────────────────────────────────────────────┘
```

## Risks / Trade-offs

- **Over-decoration noise** (false positives like `useEffect`, `setState`): mitigated by the stoplist and by only decorating tokens that have an actual GitNexus match.
- **Backend latency on first lookup**: mitigated by 300 ms debounce, LRU cache, and silent failure — the editor never blocks on the lookup.
- **Coupling to `gitnexus-impact-panel`'s unwritten Impact tab contract**: this change ships the producer side only; the CTA gracefully degrades to a no-op until the consumer lands. Declared as the key open question.
- **Markdown round-trip regression**: covered by an explicit byte-identical test (task 5.4).
- **Multiple Tiptap instances**: the LRU and debounce are per-editor; if multiple description editors are open simultaneously (e.g. in split workspace tabs), each manages its own cache. This is intentional.
