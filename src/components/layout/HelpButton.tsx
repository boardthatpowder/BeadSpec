import { openUrl } from '@tauri-apps/plugin-opener'
import { IconButton } from '../ui/IconButton'
import { Icon } from '../ui/Icon'

export function HelpButton() {
  return (
    <IconButton
      label="Help"
      onClick={() => openUrl('https://boardthatpowder.github.io/BeadSpec/')}
      className="flex items-center px-2.5 py-1 rounded-md text-sm text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
    >
      <Icon name="CircleHelp" size="md" />
    </IconButton>
  )
}
