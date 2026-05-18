## 1. Backend types & command

- [x] 1.1 Create `src-tauri/src/commands/gitnexus_symbols.rs` with types `RiskLevel` (enum: Low, Medium, High, Critical), `CallerRef { name: String, qualified_path: String }`, and `SymbolHit { name: String, qualified_path: String, kind: String, one_line_description: String, risk_level: RiskLevel, top_upstream_callers: Vec<CallerRef> }` — all deriving `serde::Serialize`, `serde::Deserialize`, and `specta::Type`.
- [x] 1.2 Implement `lookup_symbols(project_path: String, names: Vec<String>, registry: State<ProjectRegistry>) -> Result<Vec<Option<SymbolHit>>, String>` that, for each name, shells out to `npx gitnexus context --json <name>` (or delegates to the client module introduced by `gitnexus-impact-panel` if already landed) and calls `npx gitnexus impact --direction upstream --limit 3 --json <name>` for callers. Parse errors and missing names map to `None` in the output vec.
- [x] 1.3 Register `lookup_symbols` in `src-tauri/src/lib.rs` in both `tauri::generate_handler!` and `tauri_specta::collect_commands!` alongside the other commands.
- [x] 1.4 Add a `SYMBOL_STOPLIST` constant in `gitnexus_symbols.rs` (a `&[&str]` of common tokens to never decorate: `useEffect`, `useState`, `onClick`, `className`, `undefined`, `boolean`, `string`, `number`, `return`, `import`, `export`, `default`, `const`, `async`, `await`, etc.) with a comment noting the matching frontend stoplist in `SymbolMentionMark.ts`.

## 2. Backend tests

- [x] 2.1 Unit test: `lookup_symbols` with an empty `names` vec returns an empty `Vec` without shelling out.
- [x] 2.2 Unit test: when `npx gitnexus` is not on PATH (or exits non-zero), all entries in the result are `None` and no panic occurs.
- [x] 2.3 Integration test (gated behind a fixture flag): provide a mock JSON response for two names — one with a real `SymbolHit` shape, one with an empty response — and assert the returned vec has `Some(SymbolHit)` and `None` respectively.

## 3. IPC + bindings

- [x] 3.1 Regenerate `src/bindings.ts` (run the existing `specta` codegen step) and verify `SymbolHit`, `CallerRef`, `RiskLevel`, and `lookupSymbols` appear in the output.
- [x] 3.2 Add `lookupSymbols(projectPath: string, names: string[]): Promise<(SymbolHit | null)[]>` wrapper in `src/ipc.ts`, matching the style of existing IPC wrappers in that file.

## 4. Tiptap extension

- [x] 4.1 Create `src/components/task-detail/SymbolMentionMark.ts` exporting a Tiptap `Extension` that registers a ProseMirror plugin with a `DecorationSet`. The plugin state is `{ decorations: DecorationSet, pending: Set<string> }`.
- [x] 4.2 Implement the pure function `extractCandidateSymbols(text: string): string[]` in the same file (also exported for unit tests). It applies the three detection passes in priority order — backtick-fenced, CamelCase (≥ 3 chars, at least one lowercase→uppercase boundary), snake_case (≥ 1 underscore, total length > 4) — and filters the built-in stoplist.
- [x] 4.3 Wire a debounced async resolver (300 ms) that calls `lookupSymbols(projectPath, candidates)`, updates the LRU cache, and rebuilds the `DecorationSet`. Each resolved match creates an `Decoration.inline` with a CSS class `symbol-mention` and a `data-symbol-path` attribute.
- [x] 4.4 Implement an in-memory LRU (size 200) keyed by `${projectPath}::${name}`, with a 5-minute TTL. Use a simple doubly-linked-list + Map implementation or a lightweight existing utility — no external dependency required.

## 5. Frontend integration

- [x] 5.1 In `DescriptionEditor.tsx`, load `SymbolMentionMark` in the Tiptap `extensions` array, passing `projectPath` (from workspace context), the shared cache singleton, and an `onOpenImpact(qualifiedPath: string)` callback that calls the workspace tab state setter with `{ view: 'all', taskId, innerTab: 'impact', impactSymbol: qualifiedPath }`.
- [x] 5.2 Create `src/components/task-detail/SymbolMentionPopover.tsx` — a React component that accepts a `SymbolHit` and renders: qualified path (monospace small), 1-line description (body-small), risk badge (chip using `LABEL_CHIP_COLORS` palette), up to 3 upstream callers (tight list), and "Open full impact →" CTA (small text link).
- [x] 5.3 Mount a Radix `Popover.Root` triggered by `pointerenter` / `focusin` on `.symbol-mention` spans in the editor DOM (delegated event handler on the editor container). Intercept `onOpenAutoFocus` to keep focus in the editor. Close on outside-click and Escape.
- [x] 5.4 Add a regression test in `DescriptionEditor.test.ts`: load a description containing potential symbol tokens (e.g. `lookup_symbols`, `DescriptionEditor`), mount the editor with the `SymbolMentionMark` extension loaded, and assert that `editor.storage.markdown.getMarkdown()` equals the input string byte-for-byte.

## 6. Frontend tests

- [x] 6.1 Unit tests for `extractCandidateSymbols` covering: backtick-fenced token is returned first, CamelCase boundary detection (`FooBar` matches, `FOO` and `bar` do not), snake_case length gate (`ab_c` excluded, `do_thing` included), stoplist exclusion (`useEffect` returns nothing), multiple candidates on one line all returned.
- [x] 6.2 Component test for `SymbolMentionPopover`: render with zero callers and assert no callers section visible; render with three callers and assert all three names appear.
- [x] 6.3 Integration test (Vitest + Testing Library): mock `lookupSymbols` to return one `SymbolHit` for `lookup_symbols` and `null` for `RandomNonExistent`. Load a description containing both tokens. Assert: `.symbol-mention` spans exist only for the matched token; simulating hover opens the popover with the expected qualified path; the CTA button is present in the popover DOM.

## 7. Verification

- [x] 7.1 `cargo test -p beadspec_lib gitnexus_symbols::tests` passes.
- [x] 7.2 `bun tsc --noEmit` passes after bindings regen.
- [x] 7.3 `bun test` passes (all frontend unit + integration tests).
- [x] 7.4 Manual: open a task whose description mentions a real symbol from the BeadSpec codebase; verify dotted underline appears, popover opens on hover with qualified path + risk badge + callers + CTA, and CTA switches to the Impact tab (or no-ops if `gitnexus-impact-panel` has not yet landed).
- [x] 7.5 Manual: open a task description containing only `useEffect` and plain English words; confirm zero decorations are applied.
- [x] 7.6 Manual: temporarily rename `gitnexus` off PATH; confirm the editor loads normally, no underlines appear, no UI error is shown.
- [x] 7.7 `openspec validate inline-impact-on-mentions` passes.
