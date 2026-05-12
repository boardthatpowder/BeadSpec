import { useSettings } from '../../contexts/SettingsContext'
import type { NotificationPrefs } from '../../stores/settingsStore'

export function NotificationPrefsPanel() {
  const { settings, updateSettings } = useSettings()
  const prefs = settings.notificationPrefs

  const update = (patch: Partial<NotificationPrefs>) => {
    updateSettings({ notificationPrefs: { ...prefs, ...patch } })
  }

  return (
    <div className="p-4 flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-neutral-200">Notifications</h3>

      <Toggle
        label="Global mute"
        description="Suppress all notifications"
        checked={prefs.globalMute}
        onChange={v => update({ globalMute: v })}
      />

      <div className={prefs.globalMute ? 'opacity-40 pointer-events-none' : ''}>
        <Toggle
          label="Task assigned"
          description="When a task is assigned to you"
          checked={prefs.assignment}
          onChange={v => update({ assignment: v })}
        />
        <Toggle
          label="Unblocked"
          description="When a blocking dependency is resolved"
          checked={prefs.unblock}
          onChange={v => update({ unblock: v })}
        />
        <Toggle
          label="Comments"
          description="When someone comments on your tasks"
          checked={prefs.comment}
          onChange={v => update({ comment: v })}
        />
      </div>
    </div>
  )
}

function Toggle({ label, description, checked, onChange }: {
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between py-2 cursor-pointer group">
      <div>
        <div className="text-sm text-neutral-200">{label}</div>
        <div className="text-xs text-neutral-500">{description}</div>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={[
          'w-10 h-6 rounded-full transition-colors flex-shrink-0',
          checked ? 'bg-blue-500' : 'bg-neutral-700',
        ].join(' ')}
      >
        <span
          className={[
            'block w-4 h-4 rounded-full bg-white mx-1 transition-transform',
            checked ? 'translate-x-4' : 'translate-x-0',
          ].join(' ')}
        />
      </button>
    </label>
  )
}
