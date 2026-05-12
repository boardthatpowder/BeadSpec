import { openUrl } from '@tauri-apps/plugin-opener'
import { IconButton } from '../ui/IconButton'

export function HelpButton() {
  return (
    <IconButton
      label="Help"
      onClick={() => openUrl('https://boardthatpowder.github.io/BeadSpec/')}
      className="flex items-center px-2.5 py-1 rounded-md text-sm text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
    >
      <svg
        className="w-4 h-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    </IconButton>
  )
}
