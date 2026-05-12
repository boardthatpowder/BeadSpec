import { useState, useEffect, useCallback } from 'react'
import { commands, unwrap } from '../../ipc'
import { useSettings } from '../../contexts/SettingsContext'
import { NotificationPrefsPanel } from '../notifications/NotificationPrefs'
import type { AppSettings } from '../../stores/settingsStore'
import { snapToStep } from '../../stores/zoomStore'

// Global open-state managed via a module-level setter so SettingsButton can open it
// without prop drilling.
let _setOpen: ((v: boolean) => void) | null = null
export function openSettingsDialog() { _setOpen?.(true) }

export function SettingsDialog() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    _setOpen = setOpen
    return () => { _setOpen = null }
  }, [])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-24"
      onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
    >
      <div className="bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl w-full max-w-2xl max-h-[70vh] overflow-y-auto">
        <SettingsContent onClose={() => setOpen(false)} />
      </div>
    </div>
  )
}

function SettingsContent({ onClose }: { onClose: () => void }) {
  const { settings, updateSettings } = useSettings()

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 flex-shrink-0">
        <h2 className="text-base font-semibold text-neutral-100">Settings</h2>
        <button
          onClick={onClose}
          className="text-neutral-500 hover:text-neutral-300 transition-colors"
          aria-label="Close settings"
        >
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <FeaturesSection settings={settings} updateSettings={updateSettings} />
      <BinaryPathsSection settings={settings} updateSettings={updateSettings} />
      <IdentitySection settings={settings} updateSettings={updateSettings} />
      <QuickCaptureSection settings={settings} updateSettings={updateSettings} />
      <AppearanceSection settings={settings} updateSettings={updateSettings} />
      <TooltipsSection settings={settings} updateSettings={updateSettings} />
      <NotificationsSection />
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="px-6 py-3 border-b border-neutral-800">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-neutral-500">{title}</h3>
    </div>
  )
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between px-6 py-3">
      <div>
        <div className="text-sm text-neutral-200">{label}</div>
        {description && <div className="text-xs text-neutral-500 mt-0.5">{description}</div>}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={[
          'w-10 h-6 rounded-full transition-colors flex-shrink-0',
          checked ? 'bg-blue-600' : 'bg-neutral-700',
        ].join(' ')}
      >
        <span
          className={[
            'block w-4 h-4 rounded-full bg-white mx-1 transition-transform',
            checked ? 'translate-x-4' : 'translate-x-0',
          ].join(' ')}
        />
      </button>
    </div>
  )
}

interface SectionProps {
  settings: AppSettings
  updateSettings: (patch: Partial<AppSettings>) => void
}

function FeaturesSection({ settings, updateSettings }: SectionProps) {
  return (
    <div>
      <SectionHeader title="Features" />
      <ToggleRow
        label="OpenSpec integration"
        description="Enable the OpenSpec changes browser and task panels"
        checked={settings.features.openspec}
        onChange={v => updateSettings({ features: { ...settings.features, openspec: v } })}
      />
      <ToggleRow
        label="Ruflo integration"
        description="Enable Ruflo memory panels and filter chips"
        checked={settings.features.ruflo}
        onChange={v => updateSettings({ features: { ...settings.features, ruflo: v } })}
      />
    </div>
  )
}

const INPUT_CLASS = 'w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-1.5 text-sm text-neutral-200 font-mono placeholder:text-neutral-600 focus:outline-none focus:border-neutral-500 transition-colors'

function BinaryPathsSection({ settings, updateSettings }: SectionProps) {
  const { binaryPaths } = settings
  const set = (key: keyof typeof binaryPaths, value: string) =>
    updateSettings({ binaryPaths: { ...binaryPaths, [key]: value } })

  return (
    <div>
      <SectionHeader title="Binary Paths" />
      <div className="px-6 py-4 grid grid-cols-2 gap-4">
        {(['bd', 'openspec', 'ruflo'] as const).map(key => (
          <label key={key} className="flex flex-col gap-1">
            <span className="text-xs text-neutral-400 font-mono">{key}</span>
            <input
              type="text"
              value={binaryPaths[key]}
              onChange={e => set(key, e.target.value)}
              placeholder="auto-detect"
              className={INPUT_CLASS}
            />
          </label>
        ))}
        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-400 font-mono">dolt</span>
          <input
            type="text"
            value={binaryPaths.dolt}
            onChange={e => set('dolt', e.target.value)}
            placeholder="auto-detect"
            className={INPUT_CLASS}
          />
          <span className="text-xs text-neutral-600">Path changes require app restart</span>
        </label>
      </div>
    </div>
  )
}

function IdentitySection({ settings, updateSettings }: SectionProps) {
  return (
    <div>
      <SectionHeader title="Identity" />
      <div className="px-6 py-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-400">Actor (your username)</span>
          <input
            type="text"
            value={settings.actor}
            onChange={e => updateSettings({ actor: e.target.value })}
            placeholder="me"
            className={INPUT_CLASS}
          />
        </label>
      </div>
    </div>
  )
}

function QuickCaptureSection({ settings, updateSettings }: SectionProps) {
  const [shortcut, setShortcut] = useState(settings.quickCaptureShortcut)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { setShortcut(settings.quickCaptureShortcut) }, [settings.quickCaptureShortcut])

  const save = useCallback(async () => {
    if (shortcut === settings.quickCaptureShortcut) return
    setError(null)
    try {
      await unwrap(commands.registerQuickCaptureShortcut(shortcut))
      updateSettings({ quickCaptureShortcut: shortcut })
    } catch (e) {
      setError(String(e))
    }
  }, [shortcut, settings.quickCaptureShortcut, updateSettings])

  return (
    <div>
      <SectionHeader title="Quick Capture" />
      <div className="px-6 py-4 flex flex-col gap-1">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-400">Shortcut</span>
          <input
            type="text"
            value={shortcut}
            onChange={e => setShortcut(e.target.value)}
            onBlur={save}
            placeholder="CmdOrCtrl+Shift+N"
            className={INPUT_CLASS}
          />
        </label>
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    </div>
  )
}

const DENSITY_OPTIONS: { value: AppSettings['density']; label: string }[] = [
  { value: 'compact',     label: 'Compact' },
  { value: 'default',     label: 'Default' },
  { value: 'comfortable', label: 'Comfortable' },
]

function AppearanceSection({ settings, updateSettings }: SectionProps) {
  return (
    <div>
      <SectionHeader title="Appearance" />
      <div className="px-6 py-4 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <span className="text-xs text-neutral-400">Density</span>
          <div className="flex items-center gap-2">
            {DENSITY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => updateSettings({ density: opt.value })}
                className={[
                  'flex-1 py-1.5 text-xs rounded border transition-colors',
                  settings.density === opt.value
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-neutral-200 hover:border-neutral-500',
                ].join(' ')}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <label className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-400">Zoom</span>
            <span className="text-xs text-neutral-500 font-mono">{settings.zoom.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.1}
            value={settings.zoom}
            onChange={e => updateSettings({ zoom: snapToStep(parseFloat(e.target.value)) })}
            className="w-full accent-blue-500"
          />
        </label>
      </div>
    </div>
  )
}

const DELAY_OPTIONS: { value: number; label: string }[] = [
  { value: 0,    label: 'Instant' },
  { value: 250,  label: '250 ms' },
  { value: 500,  label: '500 ms' },
  { value: 1000, label: '1 s' },
]

function TooltipsSection({ settings, updateSettings }: SectionProps) {
  const { tooltips } = settings
  return (
    <div>
      <SectionHeader title="Tooltips" />
      <ToggleRow
        label="Show tooltips"
        description="Hover help for icon buttons throughout the app"
        checked={tooltips.enabled}
        onChange={v => updateSettings({ tooltips: { ...tooltips, enabled: v } })}
      />
      {tooltips.enabled && (
        <div className="px-6 py-3 flex flex-col gap-2">
          <span className="text-xs text-neutral-400">Hover delay</span>
          <div className="flex items-center gap-2">
            {DELAY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => updateSettings({ tooltips: { ...tooltips, delayMs: opt.value } })}
                className={[
                  'flex-1 py-1.5 text-xs rounded border transition-colors',
                  tooltips.delayMs === opt.value
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-neutral-200 hover:border-neutral-500',
                ].join(' ')}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function NotificationsSection() {
  return (
    <div>
      <SectionHeader title="Notifications" />
      <NotificationPrefsPanel />
    </div>
  )
}
