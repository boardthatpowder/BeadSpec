# Release Process

Releases are automated via GitHub Actions. A new release is triggered by pushing a `v*` tag.

## Prerequisites

The following secrets must be set in the GitHub repository settings:

| Secret | Purpose |
|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | Signs the update payload for the Tauri updater |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password for the signing key |

To generate a signing key pair:
```bash
tauri signer generate -w ~/.tauri/beadspec.key
```

Add the private key (`~/.tauri/beadspec.key`) as `TAURI_SIGNING_PRIVATE_KEY` and the password as `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` in GitHub → Settings → Secrets and variables → Actions.

The public key is already embedded in `src-tauri/tauri.conf.json` under `plugins.updater.pubkey`.

## Cutting a release

1. Update `CHANGELOG.md` — move items from `[Unreleased]` to a new `[x.y.z]` section with today's date.

2. Bump the version in three places (they must match):
   - `src-tauri/tauri.conf.json` → `"version"`
   - `src-tauri/Cargo.toml` → `version`
   - `package.json` → `"version"`

3. Commit:
   ```bash
   git add CHANGELOG.md src-tauri/tauri.conf.json src-tauri/Cargo.toml package.json
   git commit -m "chore: release v0.x.0"
   ```

4. Tag and push:
   ```bash
   git tag v0.x.0
   git push && git push --tags
   ```

5. The `release.yml` workflow triggers automatically. It:
   - Builds installers for macOS (universal), Windows, and Ubuntu 22.04
   - Creates a **draft** GitHub release with all installers attached
   - Signs the update manifest for the Tauri updater

6. Go to the [Releases page](https://github.com/boardthatpowder/BeadSpec/releases), review the draft, and **Publish release** when ready.

## Update distribution

The Tauri updater checks:
```
https://github.com/boardthatpowder/BeadSpec/releases/latest/download/latest.json
```

`tauri-action` generates and attaches `latest.json` automatically as part of the release build. The signed `latest.json` is what tells installed copies of BeadSpec that an update is available.

## Platform notes

- **macOS**: builds a universal binary (`aarch64-apple-darwin` + `x86_64-apple-darwin`). The `.dmg` is not notarized by default — see [Apple notarization](https://v2.tauri.app/distribute/sign/macos/) for that setup.
- **Windows**: builds `.msi` and `.exe` installers. Not code-signed by default.
- **Linux**: builds `.AppImage`, `.deb`, and `.rpm`.
