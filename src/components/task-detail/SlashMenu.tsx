import { useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { Button } from '../ui/Button'
import { Icon, type IconName } from '../ui/Icon'

const ITEMS: Array<{ id: string; icon?: string; iconName?: IconName; label: string; desc: string }> = [
  { id: 'heading',   icon: 'H',       label: 'Heading',        desc: 'Large section heading' },
  { id: 'code',      icon: '</>',    label: 'Code block',     desc: 'Syntax highlighted' },
  { id: 'checklist', iconName: 'ListChecks', label: 'Checklist',      desc: 'Task items' },
  { id: 'quote',     icon: '"',       label: 'Quote',          desc: 'Blockquote' },
  { id: 'task',      iconName: 'Link', label: 'Task reference', desc: 'Link to a task' },
]

interface Props {
  onSelect: (id: string) => void
  onClose: () => void
  onTask?: () => void
}

export function SlashMenu({ onSelect, onClose, onTask }: Props) {
  const [selected, setSelected] = useState(0)

  useHotkeys('escape', onClose, { enableOnFormTags: true })
  useHotkeys(
    'arrowdown',
    () => setSelected(s => Math.min(s + 1, ITEMS.length - 1)),
    { enableOnFormTags: true },
  )
  useHotkeys(
    'arrowup',
    () => setSelected(s => Math.max(s - 1, 0)),
    { enableOnFormTags: true },
  )
  useHotkeys(
    'enter',
    () => {
      const item = ITEMS[selected]
      if (item.id === 'task' && onTask) { onTask(); return }
      onSelect(item.id)
    },
    { enableOnFormTags: true },
  )

  return (
    <div className="absolute left-0 top-full mt-1 z-50 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl py-1 w-52">
      {ITEMS.map((item, i) => (
        <Button
          key={item.id}
          variant="ghost"
          size="sm"
          type="button"
          onClick={() => { if (item.id === 'task' && onTask) { onTask(); return } onSelect(item.id) }}
          onMouseEnter={() => setSelected(i)}
          className={[
            'h-auto w-full justify-start rounded-none border-0 px-3 py-2 text-left text-sm font-normal',
            i === selected ? 'bg-neutral-800' : 'hover:bg-neutral-800',
          ].join(' ')}
        >
          <span className="w-7 h-7 rounded bg-neutral-800 flex items-center justify-center text-xs text-neutral-400 font-mono flex-shrink-0">
            {item.iconName ? <Icon name={item.iconName} size="sm" /> : item.icon}
          </span>
          <div>
            <div className="text-neutral-200">{item.label}</div>
            <div className="text-xs text-neutral-500">{item.desc}</div>
          </div>
        </Button>
      ))}
    </div>
  )
}
