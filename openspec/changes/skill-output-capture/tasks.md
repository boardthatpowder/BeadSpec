## 1. CLI helper

- [ ] 1.1 Write `scripts/bd-capture-review.sh`: parse `--kind`, `--branch`, `--pr`, `--title`, `--dedupe-sha` args; fail with exit 2 on missing required args.
- [ ] 1.2 Resolve `ruflo_key_prefix` via `source ~/.claude/ruflo/lib/tags.sh`; fail with exit 3 if unavailable.
- [ ] 1.3 Build the structured key (`<prefix>|review:<kind>|branch:<name>|[pr:<num>|]ts:<epoch>`) and call `ruflo memory store -k "$KEY" -v "$BODY"`; fail with exit 4 on non-zero result.
- [ ] 1.4 Implement `--dedupe-sha`: compute `sha256` of body; abort (exit 0 + warning) if a key containing `sha:<digest>` already exists in `ruflo memory search` results.
- [ ] 1.5 `chmod +x scripts/bd-capture-review.sh`; smoke-test all exit codes in a manual session.

## 2. Backend types & module

- [ ] 2.1 Create `src-tauri/src/commands/reviews.rs`; define `ReviewKind` enum, `ReviewEntry` struct, and `ReviewScope` enum, all deriving `serde::Serialize`, `serde::Deserialize`, and `specta::Type`.
- [ ] 2.2 Implement `list_reviews(project_path, scope)`: shell out to `ruflo memory search -q <query> --json`; parse JSON into `Vec<ReviewEntry>`; parse key segments defensively (skip unparseable entries with a `tracing::warn`).
- [ ] 2.3 Implement `get_review(key)`: call `ruflo memory retrieve -k <key> --json`; return `ReviewEntry` with full `body` populated.
- [ ] 2.4 Register both commands in `src-tauri/src/lib.rs` in `tauri::generate_handler!` and `tauri_specta::collect_commands!`.

## 3. Backend tests

- [ ] 3.1 Unit-test key-parsing helper: valid key round-trips; missing `review:` segment returns `None`; inner-colon slug `review:pr-review:extra` parses kind correctly (split on first colon after segment name).
- [ ] 3.2 Unit-test `ReviewKind` deserialisation from string segments.
- [ ] 3.3 Integration test `list_reviews` with a mocked `ruflo memory search` subprocess: seed two entries, assert returned `Vec<ReviewEntry>` length and field values.
- [ ] 3.4 Test that `list_reviews` with scope `Branch("feat/x")` generates the correct search query substring and filters entries for other branches.

## 4. IPC + bindings

- [ ] 4.1 Regenerate `src/bindings.ts` via `bun tauri build` (or specta codegen script) to include `ReviewKind`, `ReviewEntry`, `ReviewScope`, `listReviews`, `getReview`.
- [ ] 4.2 Add `listReviews(projectPath, scope): Promise<ReviewEntry[]>` and `getReview(key): Promise<ReviewEntry>` wrappers in `src/ipc.ts`, following the `invoke<T>` pattern of `getChangeBeadsProgress`.

## 5. Frontend components

- [ ] 5.1 Create `src/components/reviews/ReviewRow.tsx`: renders kind pill (using `LABEL_CHIP_COLORS` neutrals: slate/amber/rose), title, relative timestamp; click handler toggles expansion.
- [ ] 5.2 Create `src/components/reviews/ReviewMarkdownViewer.tsx`: wraps the existing Tiptap markdown renderer for read-only display of review body; if the renderer requires context coupling, add a thin wrapper.
- [ ] 5.3 Create `src/components/reviews/ReviewsSection.tsx`: fetches `listReviews` scoped by branch (and PR if available); renders a list of `ReviewRow`; hides the entire section (no placeholder) when the result is empty; absent and makes no IPC call when Ruflo is disabled.

## 6. TaskDetailPanel integration

- [ ] 6.1 In `TaskDetailPanel.tsx`, derive `branch` from the task's `branch:<name>` label using the existing label-parse helper (split on first colon).
- [ ] 6.2 Mount `ReviewsSection` in the Activity tab below the Related Memories section and above the Git/Dolt History section, gated on the Ruflo feature flag. No IPC call and no render when Ruflo is disabled.

## 7. BdHealthPanel integration

- [ ] 7.1 Add a "Reviews" sub-tab to `BdHealthPanel` alongside existing health check sections.
- [ ] 7.2 Implement branch grouping (collapsible rows), kind filter chips (PR / Code / Security — all active by default), and text search over titles.
- [ ] 7.3 Render each row as a `ReviewRow`; clicking opens `ReviewMarkdownViewer` inline.
- [ ] 7.4 Show the empty state copy "No reviews captured yet. Run a review skill and pipe through `scripts/bd-capture-review.sh`." when the result is empty.

## 8. Skill updates (follow-up, out of scope for this change)

- [ ] 8.1 Add a "Save with bd-capture-review" final step to `code-review:code-review` SKILL.md: `<review output> | scripts/bd-capture-review.sh --kind code-review --branch <branch>`.
- [ ] 8.2 Same for `security-review` SKILL.md: `--kind security-review`.
- [ ] 8.3 Same for `gitnexus-pr-review` SKILL.md: `--kind pr-review --pr <num>`.

## 9. Verification

- [ ] 9.1 `cargo test` passes for the new `reviews` module.
- [ ] 9.2 `bun tsc --noEmit` passes after bindings regeneration.
- [ ] 9.3 `openspec validate skill-output-capture` passes with zero errors.
- [ ] 9.4 Manual smoke: pipe a synthetic review through `scripts/bd-capture-review.sh --kind code-review --branch feat/test`; verify the entry appears in the Activity tab Reviews section for a task labelled `branch:feat/test`, and in the BdHealthPanel Reviews sub-tab.
- [ ] 9.5 Manual smoke: verify Ruflo-disabled mode hides the Reviews section and makes no IPC calls (confirm via DevTools network log).
