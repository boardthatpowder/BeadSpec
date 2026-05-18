import { openUrl } from '@tauri-apps/plugin-opener'
import { IconButton } from '../ui/IconButton'
import { Icon } from '../ui/Icon'

export function HelpButton() {
  return (
    <IconButton
      label="Help"
      onClick={() => openUrl('https://boardthatpowder.github.io/BeadSpec/')}
      className="flex items-center px-2.5 py-1 rounded-md text-sm text-[--color-fg-muted] hover:text-[--color-fg] hover:bg-[--color-surface-hi] transition-colors"
    >
      <Icon name="CircleHelp" size="md" />
    </IconButton>
  )
}
