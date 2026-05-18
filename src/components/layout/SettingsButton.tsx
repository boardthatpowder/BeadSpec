import { openSettingsDialog } from '../settings/SettingsDialog'
import { IconButton } from '../ui/IconButton'
import { Icon } from '../ui/Icon'

export function SettingsButton() {
  return (
    <IconButton
      label="Settings"
      shortcut="⌘,"
      onClick={() => openSettingsDialog()}
      className="flex items-center px-2.5 py-1 rounded-md text-sm text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
    >
      <Icon name="Settings" size="md" />
    </IconButton>
  )
}
