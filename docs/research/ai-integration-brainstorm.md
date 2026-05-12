# AI Features for BeadSpec — Research & Brainstorm

## Context

BeadSpec is a Tauri 2 desktop client for the `bd` (beads) issue tracker. Current stack: React 19 + TypeScript + Tailwind 4, TanStack Query + Zustand, TipTap editor, dependency graph (xyflow/cytoscape), system tray. Reads SQL directly from a Dolt DB; writes shell out to the `bd` CLI. No AI integrations exist today (zero matches for `openai|anthropic|claude|llm|gpt` across the codebase).

The user wants to (a) brainstorm useful AI functions for this app and (b) understand what libraries can bridge to whatever AI assistant a user already has — i.e. a "bring your own model/key" stance, not lock-in to one provider.

This document captures the option space so a follow-up session can pick one or two features to prototype.

---

## Part 1 — Brainstorm: useful AI functions

Grouped by where the value lives in the existing UX.

### A. Task authoring (TipTap editor + create modal)
1. **AI slash commands in the description editor** — `/ai write acceptance criteria`, `/ai expand`, `/ai rewrite as user story`, `/ai split into subtasks`. Hooks into the existing TipTap slash menu.
2. **Smart create from a one-liner** — user types "fix flaky login test"; AI proposes title, description, labels, type (bug), priority, and a list of suggested dependencies (existing issues that look related).
3. **Bulk import / brain-dump → issues** — paste meeting notes or a Slack thread, get a draft set of issues with inferred dependency edges.

### B. Triage & metadata
4. **Auto-suggest labels, type, priority** on create/edit, learned from existing labelled issues in the project (few-shot from nearest neighbours via embeddings).
5. **Duplicate / near-duplicate detection** — when creating an issue, surface the top-3 similar existing issues (semantic search over title+description embeddings).
6. **Auto-assignee suggestion** based on who has historically closed similar work (label/path/title overlap).

### C. Search & navigation
7. **Natural-language filter bar** — "high-priority bugs assigned to me that are blocked by API work" → translate to existing `TaskFilters` shape. Cheaper and more reliable than free-form chat.
8. **Semantic search** alongside the existing keyword search (hybrid sparse+dense), reusing the same `search_tasks` UI.
9. **"Find related issues"** action on any task — uses embeddings, surfaces in the task detail panel.

### D. Dependency graph reasoning
10. **"Why is this blocked?" explainer** — walks `dependencies[]`, summarises the critical path in plain English on the graph tab.
11. **Cycle / risk detector** — flag dependency cycles, orphans, or chains that look misordered ("this UI task depends on a task labelled `backend` that is still `open`").
12. **Sprint/iteration packer** — "give me a ready-to-start set that fits ~2 weeks for one engineer, respecting dependencies."

### E. Activity & comments
13. **Activity timeline summariser** — collapse long histories into "what changed since I last looked."
14. **Comment draft assistant** — "draft a status update from the last N commits + recent activity."
15. **Daily/weekly digest** — tray popover or notification: "5 issues moved to ready, 2 closed, 1 newly blocked."

### F. Outside-the-app integrations
16. **Expose BeadSpec as an MCP server** — high leverage: the user already drives Claude Code daily, and the workspace `CLAUDE.md` already pushes Beads workflows. An MCP server bridging the running app's project context (active project, current filters, selected task) lets Claude Code answer "what should I work on next in this repo?" without re-discovering state. Could ship from the Tauri Rust side using `rmcp` (Rust MCP SDK) or from a Node sidecar with `@modelcontextprotocol/sdk`.
17. **Consume external MCP servers inside the app** — e.g. a GitHub MCP server to enrich an issue with linked PR status, or a docs MCP to ground "write acceptance criteria" in product spec.
18. **Git/commit ↔ issue linker** — scan recent commits in the project's repo for `bd-NNN` style refs and propose status transitions / closes.

### G. Highest-leverage shortlist
If picking only 2–3 to prototype first:
- **(1) AI slash commands in the TipTap editor** — visible, low blast radius, exercises the whole BYOK + streaming + tool plumbing once.
- **(5) Duplicate detection on create** — small, measurable, embedding-only (no chat UX), directly reduces a real pain point.
- **(16) MCP server exposing the app's project context** — uniquely valuable given the user's existing Claude Code workflow; nothing else in the market does this for Beads.

---

## Part 2 — Library landscape (the "bridge")

Goal: one codepath that talks to whichever provider the user has — OpenAI, Anthropic, Google, OpenRouter, local Ollama / LM Studio, or future ones — without rewriting features.

### Multi-provider abstraction (TS-side)

| Library | Package(s) | License | Notes |
|---|---|---|---|
| **Vercel AI SDK v5** *(recommended)* | `ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`, `@openrouter/ai-sdk-provider`, `ollama-ai-provider-v2` | Apache-2.0 | TS-first unified API across 25+ providers, swap provider in 2 lines. `streamText`, `generateObject`/`streamObject` (Zod schemas), `tool({...})` for tool use, `experimental_createMCPClient().tools()` for MCP. ~67 kB gz. |
| LangChain.js | `langchain`, `@langchain/*` | MIT | Heavier (~101 kB gz), best when you want pre-built agent graphs / RAG chains. Overkill for the features above. |
| LlamaIndex.ts | `llamaindex` | MIT | RAG-focused; useful only if heavy doc grounding becomes a feature. |
| OpenAI SDK + custom `baseURL` | `openai` | Apache-2.0 | Smallest (~34 kB). Many providers (Groq, OpenRouter, LM Studio, Ollama) speak OpenAI-compatible — viable minimal path. |
| Token.js | `token.js` | MIT | Lightweight unified client without React hooks. |
| LiteLLM (proxy) | n/a (Python) | MIT | Run as sidecar for centralised cost tracking; ops overhead, opt-in only. |

**Recommendation:** Vercel AI SDK v5 as the default bridge. It already covers streaming, tool use, structured output, and MCP tool consumption with one API; provider packages are tree-shakeable so the bundle only includes what's enabled.

### MCP (Model Context Protocol)
- **`@modelcontextprotocol/sdk`** (TS, MIT) — both client and server, transports: stdio + Streamable HTTP. Plugs straight into AI SDK's `tools` argument.
- **`rmcp`** (Rust) — usable from the existing Tauri backend if exposing BeadSpec as an MCP server is preferred to a Node sidecar.

### Local model runners (for users who want fully offline / no key)
- **Ollama** — `ollama` npm package, or `ollama-ai-provider-v2` via AI SDK. Auto-detect `localhost:11434`.
- **LM Studio** — OpenAI-compatible at `localhost:1234`; reuse OpenAI SDK with custom `baseURL`.
- **llama.cpp** — `node-llama-cpp` as a Tauri sidecar for embedded fully-offline mode (heavier ship).

### Key storage (BYOK)
- **`tauri-plugin-keyring`** — uses macOS Keychain / Windows Credential Manager / Linux Secret Service. Avoid `tauri-plugin-stronghold` (deprecating in Tauri v3).
- Make provider HTTP calls from the Rust side where possible to keep keys out of the JS heap.

### BYOK UX patterns worth copying
- Provider registry settings page (Raycast 1.100, Cursor, Zed).
- **Model aliasing** — map logical roles (`chat`, `code`, `embed`, `cheap`) to provider+model so features aren't hardcoded.
- Local-first default (auto-detect Ollama) with cloud opt-in (Zed pattern).
- OpenRouter as the easy "one key, many models" on-ramp alongside per-provider keys.
- Show usage/cost from AI SDK's `usage` field per request.

### Embeddings (for features 5, 8, 9)
- Cloud: `@ai-sdk/openai` `text-embedding-3-small`, Voyage, Cohere — all via AI SDK's `embed`/`embedMany`.
- Local: Ollama embedding models (`nomic-embed-text`, `bge-m3`); fully offline.
- Storage: start with sqlite-vec or even an in-memory vector store keyed off the existing Dolt DB; the issue corpus is small.

---

## Part 3 — A concrete first slice (if the user wants to prototype)

If the user picks "AI slash commands in TipTap" as the first slice, the minimal pieces are:

1. **Settings page** for providers (`src/components/settings/` — new) — provider, model alias map, key (stored via `tauri-plugin-keyring`).
2. **Rust command** `ai_complete` in `src-tauri/src/commands/` that takes a prompt + role and streams from the user's chosen provider; or a TS-side `ai` SDK call if simpler.
3. **TipTap extension** in `src/components/task-detail/editor/` (existing slash menu lives here) adding `/ai …` commands that call the above and stream into the document.
4. **Telemetry** — surface tokens + latency in the toast system already in place.

Critical files to read before implementing:
- `src/components/task-detail/` — TipTap setup and slash menu
- `src-tauri/src/commands/` — pattern for Tauri commands
- `src-tauri/src/main.rs` and `lib.rs` — command registration + plugins

### Verification
- Local: build with `bun tauri dev`, configure both an Ollama model and an Anthropic key, run each `/ai` command end-to-end with both providers.
- Toggle off network and confirm Ollama path still works.
- Confirm the API key is not present in the JS heap (DevTools memory snapshot) when calls go through the Rust path.

---

## Open questions for the user
- Which slice should we prototype first? (A/B/C/D/E/F or a specific numbered idea.)
- Does the app need to support fully-offline use (i.e. ship local-model support from day one), or is BYOK to cloud providers enough for v1?
- Should the MCP-server idea (#16) be the headline feature given the existing Claude Code workflow?

---

## Recorded preferences (for the next session)

- **Document status:** research/brainstorm only — no implementation plan to be produced now.
- **Top area of interest when a slice is picked:** **Natural-language filter bar** (idea #7) — translate prose like "high-pri bugs assigned to me blocked by API work" into the existing `TaskFilters` shape.
- **BYOK posture for v1:** **Cloud + Ollama + bundled local model.** Support OpenAI/Anthropic/Google/OpenRouter via user-supplied keys (OS keychain via `tauri-plugin-keyring`), auto-detect local Ollama, and ship `node-llama-cpp` as a Tauri sidecar for fully offline-out-of-the-box use. Heaviest option; will impact bundle size and release engineering — flag this when planning the slice.

### Implications for the natural-language filter bar slice (when picked up)
- Structured-output is the right primitive — use AI SDK `generateObject` with a Zod schema matching `TaskFilters` (`status[]`, `priority[]`, `labels[]`, `search`). No streaming needed.
- Token budget is tiny per call → all three provider tiers (cloud / Ollama / bundled llama.cpp) are viable. Pick the smallest capable bundled model (e.g. a 1–3B instruct model) to keep ship size manageable.
- Grammar-constrained decoding via `node-llama-cpp` GBNF guarantees a valid filter object on the bundled path — worth using since the schema is small and fixed.
- Surface the parsed filter to the user before applying it (chips in the existing filter UI) so the AI never silently changes what they see.
