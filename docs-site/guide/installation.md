# Installation

BeadSpec requires the `bd` CLI to be installed first — it provides the database engine. `bd` auto-provisions Dolt on first run, so you don't need to install Dolt separately.

## Step 1: Install bd

| Platform | Command |
|---|---|
| macOS | `brew install bd` |
| Linux | Download from the [Beads releases page](https://github.com/boardthatpowder/beads/releases), make executable, and place on your `$PATH` |
| Windows | Download `bd.exe` from the [Beads releases page](https://github.com/boardthatpowder/beads/releases) and add its directory to `%PATH%` |

Verify: `bd --version`

## Step 2: Install BeadSpec

Download the latest installer from the [Releases page](https://github.com/boardthatpowder/BeadSpec/releases/latest):

### macOS

Download the `.dmg`, open it, and drag BeadSpec to `/Applications`.

::: warning Gatekeeper
Unsigned builds are blocked by macOS Gatekeeper on first launch. To open:
- Right-click `BeadSpec.app` → **Open** → **Open**
- Or from Terminal: `xattr -d com.apple.quarantine /Applications/BeadSpec.app`
:::

### Windows

Download `.msi` (recommended) or `.exe` and run the installer.

::: tip SmartScreen
Windows may show a SmartScreen warning for unsigned builds. Click **More info** → **Run anyway**.
:::

### Linux

**AppImage** (works on most distributions):
```bash
chmod +x BeadSpec_0.1.0_amd64.AppImage
./BeadSpec_0.1.0_amd64.AppImage
```

**Debian/Ubuntu** (`.deb`):
```bash
sudo dpkg -i beadspec_0.1.0_amd64.deb
```

**Fedora/RHEL** (`.rpm`):
```bash
sudo rpm -i beadspec-0.1.0-1.x86_64.rpm
```

**Required system library** (Ubuntu 22.04+):
```bash
sudo apt-get install libwebkit2gtk-4.1-0
```

## Step 3: Launch

Open BeadSpec. If it can't find `bd` on your `PATH`, a setup dialog appears — use it to point BeadSpec at the `bd` binary directly.

## Building from Source

See [Contributing → Getting Started](/contributing/) for build prerequisites and instructions.
