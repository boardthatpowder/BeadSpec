## 1. Settings & Context

- [x] 1.1 Add `theme: 'system' | 'dark' | 'light'` to `AppSettings` type and `DEFAULT_SETTINGS` (default: `'system'`) in `src/contexts/SettingsContext.tsx`
- [x] 1.2 Update `loadSettings` migration in `SettingsContext` to handle missing `theme` field gracefully (fall back to `'system'`)
- [x] 1.3 Create `src/lib/theme.ts` exporting `useThemeEffect(theme: AppSettings['theme'])` — applies `data-theme` to `document.documentElement`, listens for OS `prefers-color-scheme` changes when `theme === 'system'`
- [x] 1.4 Call `useThemeEffect(settings.theme)` in `src/components/layout/index.tsx` (AppLayout)
- [x] 1.5 Call `useThemeEffect` in `src/QuickCaptureApp.tsx` — read `theme` from plugin-store directly since QuickCapture doesn't use SettingsContext

## 2. CSS Token Override

- [x] 2.1 Add `[data-theme="light"] { … }` block to `src/index.css` with all 14 `--color-*` token overrides (see design.md D2 for the full mapping: white/neutral-50/100/200/300/900/600/500 + blue-600/green-600/amber-600/red-600/blue-500)
- [x] 2.2 Run `bun run dev`, switch to Light in Settings, visually walk every view — confirm no white-on-white or black-on-black surfaces

## 3. Theme Picker in Settings

- [x] 3.1 Add a Theme picker row to `AppearanceSection` in `src/components/settings/SettingsDialog.tsx` — three equal-width buttons (System / Light / Dark) styled like the existing Density picker; active button uses accent background
- [x] 3.2 Verify: open Settings → Appearance → click Light → app switches instantly; click Dark → switches; click System → follows OS

## 4. Hardcoded Color Audit

- [x] 4.1 Run `grep -r "bg-neutral-950" src/components/ --include="*.tsx" -l` — list all files; replace each `bg-neutral-950` with `bg-[--color-bg]`
- [x] 4.2 Run `grep -r "bg-neutral-900[^/]" src/components/ --include="*.tsx" -l` — replace `bg-neutral-900` (non-opacity-modified) with `bg-[--color-surface]`
- [x] 4.3 Run `grep -r "bg-black" src/components/ --include="*.tsx" -l` — replace with `bg-[--color-bg]` (or keep as backdrop color for dialogs — those are intentional and should get a `/* intentionally opaque backdrop */` comment)
- [x] 4.4 Run `grep -r "text-neutral-100\b" src/components/ --include="*.tsx" -l` — replace with `text-[--color-fg]`
- [x] 4.5 Run `grep -r "border-neutral-800\b" src/components/ --include="*.tsx" -l` — replace with `border-[--color-border]`
- [x] 4.6 Run `grep -r "border-neutral-700\b" src/components/ --include="*.tsx" -l` — replace with `border-[--color-border-strong]`
- [x] 4.7 Verify Quick Capture renders correctly in light mode after token replacement

## 5. Tauri Config

- [x] 5.1 In `src-tauri/tauri.conf.json` main window config: verify `"theme"` field is absent or set to `"Auto"` so native decorations follow OS

## 6. Quality Gates

- [x] 6.1 Run `bun run typecheck` — zero errors
- [x] 6.2 Run `bun test` — all tests pass
- [x] 6.3 Run `bun run lint` — zero errors
- [x] 6.4 Visual walk in Light mode: open every view (TaskList, TaskDetail, ChangesBrowser, ActivityFeed, MemoryBrowser, ProcessBrowser, Sessions, Health, EpicDashboard) — no white-on-white or black-on-black
- [x] 6.5 Visual walk in Dark mode: confirm zero regressions vs pre-change appearance
- [x] 6.6 Verify System mode: toggle OS to dark/light while app is open — app switches without restart
- [x] 6.7 Open Quick Capture in Light mode — renders with light tokens
- [x] 6.8 Verify `grep -r "bg-neutral-950\|bg-black\|text-neutral-100" src/components/` returns no unintentional matches
- [x] 6.9 Run `openspec validate ui-light-mode` — passes
