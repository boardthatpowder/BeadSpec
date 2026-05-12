# Testing

## Running the test suite

```bash
# TypeScript type check
bun run typecheck

# ESLint (must pass with zero warnings)
bun run lint

# Rust unit tests
cd src-tauri && cargo test

# Rust linting
cd src-tauri && cargo clippy -- -D warnings

# Rust formatting check
cd src-tauri && cargo fmt -- --check

# Frontend unit tests (vitest)
bun test

# Full frontend build smoke test
bun run build
```

## CI gates

Every PR must pass the CI workflow (`.github/workflows/ci.yml`) which runs:
- TypeScript typecheck
- ESLint
- Frontend build
- Cargo fmt check
- Cargo clippy
- Cargo test

across macOS, Windows, and Ubuntu.

## Writing tests

### Rust

Place unit tests in the same file as the code under test (in a `#[cfg(test)] mod tests { }` block) or in `src-tauri/tests/` for integration tests.

Use `tempfile` (already a dev dependency) for filesystem fixtures.

### Frontend

Tests use [Vitest](https://vitest.dev/) and live in `src/**/__tests__/` or alongside their component as `*.test.ts` / `*.test.tsx`.

Use real Tauri IPC where possible rather than mocking `invoke()`. For pure React component tests, mocking the data layer is fine.

## What to test

- Pure logic functions in `src/lib/` and `src/utils/` — these are the highest-value tests
- Rust functions with non-trivial logic in `src-tauri/src/`
- Critical UI behaviors (filter logic, keyboard navigation) via component tests

You do not need to mock the Dolt database for unit tests. Integration tests that exercise `bd` commands or SQL queries should use a real `bd` environment when possible.

## CI-only checks

The following are enforced in CI but are good to run locally too:
- `cargo fmt -- --check` — Rust formatting
- `cargo clippy -- -D warnings` — no Rust warnings
