# Hooks

## Optional activity-feed writeback

Tools can publish workflow events into Ruflo memory for the Activity view. The
backend polls entries whose key includes `type:event` and emits them on the
`workflow:activity` Tauri topic.

Key schema:

```text
branch:<b>|worktree:<w>|repo:<r>|type:event|kind:<k>|ts:<unix>
```

Value JSON schema:

```json
{ "summary": "...", "detail": {}, "correlation_id": "BEADSPEC-123" }
```

Kind namespace:

| Prefix | Source |
| --- | --- |
| `bd.*` | Beads issue changes |
| `hook.*` | Local hooks and scripts |
| `gitnexus.*` | GitNexus index and impact events |
| `worker.*` | Background workers |
| `session.*` | Session lifecycle events |

Copy-paste example:

```bash
ruflo memory store -k "$(source ~/.claude/ruflo/lib/tags.sh && ruflo_key_prefix)|type:event|kind:hook.example|ts:$(date +%s)" -v '{"summary":"example event","detail":{}}'
```
