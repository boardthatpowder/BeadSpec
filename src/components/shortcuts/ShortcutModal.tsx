import { useEffect, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { useModifierLabel } from './ShortcutProvider'
import { commands } from '../../bindings'
import type { ShortcutStatus } from '../../bindings'

interface ShortcutEntry {
  keys: string     // e.g. "⌘K" or "Ctrl+K" — use {mod} as placeholder
  description: string
  group: string
}

const SHORTCUTS: ShortcutEntry[] = [
  { group: 'Navigation', keys: '{mod}+K', description: 'Open command palette' },
  { group: 'Navigation', keys: 'J', description: 'Move selection down (focus only)' },
  { group: 'Navigation', keys: 'K', description: 'Move selection up (focus only)' },
  { group: 'Navigation', keys: '↓ / ↑', description: 'Navigate list (opens preview tab)' },
  { group: 'Navigation', keys: 'Enter', description: 'Pin focused task as a tab' },
  { group: 'Navigation', keys: 'Backspace', description: 'Navigate back (dep graph)' },
  { group: 'Task Actions', keys: 'Space', description: 'Quick status change' },
  { group: 'Task Actions', keys: '/', description: 'Focus filter input' },
  { group: 'App', keys: '?', description: 'Show keyboard shortcuts' },
  { group: 'App', keys: '{mod}+=', description: 'Zoom in' },
  { group: 'App', keys: '{mod}+-', description: 'Zoom out' },
  { group: 'App', keys: '{mod}+0', description: 'Reset zoom' },
  // Workspace shortcuts (task 9.3)
  { group: 'Workspace', keys: '{mod}+W', description: 'Close active tab' },
  { group: 'Workspace', keys: '{mod}+Shift+T', description: 'Reopen last closed tab' },
  { group: 'Workspace', keys: '{mod}+\\', description: 'Split pane right' },
  { group: 'Workspace', keys: '{mod}+Shift+\\', description: 'Split pane down' },
  { group: 'Workspace', keys: 'Ctrl+Tab', description: 'Next tab in pane' },
  { group: 'Workspace', keys: 'Ctrl+Shift+Tab', description: 'Previous tab in pane' },
  { group: 'Workspace', keys: '{mod}+1–9', description: 'Jump to tab N' },
]

export function ShortcutModal() {
  const [open, setOpen] = useState(false)
  const mod = useModifierLabel()
  const [quickCaptureStatus, setQuickCaptureStatus] = useState<ShortcutStatus | null>(null)

  useHotkeys('?', () => setOpen(o => !o), { preventDefault: true })
  useHotkeys('escape', () => setOpen(false))

  // Load quick-capture shortcut status when modal opens
  useEffect(() => {
    if (!open) return
    commands.getShortcutStatus().then(status => {
      setQuickCaptureStatus(status)
    }).catch(() => {/* ignore */})
  }, [open])

  if (!open) return null

  const groups = Array.from(new Set(SHORTCUTS.map(s => s.group)))

  // Format CmdOrCtrl+Shift+N → {mod}+Shift+N for display
  const formatShortcut = (s: string) =>
    s.replace(/CmdOrCtrl/g, mod).replace(/CommandOrControl/g, mod)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl p-6 w-96 max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-neutral-100 font-semibold mb-4 text-sm">Keyboard Shortcuts</h2>
        {groups.map(group => (
          <div key={group} className="mb-4">
            <div className="text-neutral-500 text-xs uppercase tracking-wider mb-2">{group}</div>
            {SHORTCUTS.filter(s => s.group === group).map(s => (
              <div key={s.keys} className="flex justify-between items-center py-1">
                <span className="text-neutral-300 text-sm">{s.description}</span>
                <kbd className="bg-neutral-800 border border-neutral-700 text-neutral-400 text-xs px-2 py-0.5 rounded font-mono">
                  {s.keys.replace('{mod}', mod)}
                </kbd>
              </div>
            ))}
          </div>
        ))}

        {/* Quick Capture global shortcut row */}
        <div className="mb-4">
          <div className="text-neutral-500 text-xs uppercase tracking-wider mb-2">Global</div>
          <div className="flex justify-between items-center py-1 gap-2">
            <span className="text-neutral-300 text-sm">Quick Capture</span>
            <div className="flex items-center gap-2">
              {quickCaptureStatus && !quickCaptureStatus.available && (
                <span className="bg-yellow-900/60 border border-yellow-700 text-yellow-400 text-xs px-1.5 py-0.5 rounded">
                  Unavailable — conflict with another app
                </span>
              )}
              <kbd className="bg-neutral-800 border border-neutral-700 text-neutral-400 text-xs px-2 py-0.5 rounded font-mono">
                {quickCaptureStatus
                  ? formatShortcut(quickCaptureStatus.shortcut)
                  : `${mod}+Shift+N`}
              </kbd>
            </div>
          </div>
        </div>

        <p className="text-neutral-600 text-xs mt-4 text-center">Press ? or Esc to close</p>
      </div>
    </div>
  )
}
