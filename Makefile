.PHONY: ci ci-rust ci-frontend ci-docs

# Run all CI checks locally, matching GitHub Actions exactly.
# Runs `rustup update stable` first so clippy/fmt versions match CI.
ci: ci-rust ci-frontend ci-docs

ci-rust:
	rustup update stable
	cargo +stable fmt --manifest-path src-tauri/Cargo.toml -- --check
	cargo +stable clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
	cargo +stable test --manifest-path src-tauri/Cargo.toml

ci-frontend:
	bun install
	bun run typecheck
	bun run lint
	bunx vite build

ci-docs:
	cd docs-site && bun install --frozen-lockfile && bun run docs:build
