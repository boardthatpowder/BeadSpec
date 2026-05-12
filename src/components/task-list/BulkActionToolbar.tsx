import { useState } from 'react'
import { commands, unwrap } from '../../ipc'
import { useQueryClient } from '@tanstack/react-query'
import { useActiveProject } from '../../hooks/useProject'
import { useToast } from '../ui/Toast'

const STATUSES = ['open', 'in_progress', 'blocked', 'closed']

interface Props {
  selectedIds: string[]
  onClear: () => void
}

export function BulkActionToolbar({ selectedIds, onClear }: Props) {
  const project = useActiveProject()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [labelInput, setLabelInput] = useState('')
  const [busy, setBusy] = useState(false)

  if (!selectedIds.length) return null

  const bulkStatus = async (status: string) => {
    if (!project) return
    setBusy(true)
    try {
      await Promise.all(selectedIds.map(id =>
        unwrap(commands.changeTaskStatus(project, id, status, false))
      ))
      queryClient.invalidateQueries({ queryKey: ['tasks', project] })
      toast(`Updated ${selectedIds.length} tasks to ${status}`)
      onClear()
    } catch (e) { toast(`Bulk status failed: ${e}`) }
    finally { setBusy(false) }
  }

  const bulkLabel = async () => {
    if (!project || !labelInput.trim()) return
    setBusy(true)
    try {
      await Promise.all(selectedIds.map(id =>
        unwrap(commands.addLabel(project, id, labelInput.trim()))
      ))
      queryClient.invalidateQueries({ queryKey: ['tasks', project] })
      toast(`Added label "${labelInput.trim()}" to ${selectedIds.length} tasks`)
      setLabelInput('')
      onClear()
    } catch (e) { toast(`Bulk label failed: ${e}`) }
    finally { setBusy(false) }
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-blue-900/20 border-b border-blue-800/40 flex-shrink-0">
      <span className="text-xs text-blue-300 font-medium">{selectedIds.length} selected</span>
      <div className="w-px h-4 bg-neutral-700" />
      <select
        onChange={e => e.target.value && bulkStatus(e.target.value)}
        disabled={busy}
        defaultValue=""
        className="bg-neutral-800 border border-neutral-700 text-xs text-neutral-300 rounded px-2 py-1 outline-none"
      >
        <option value="" disabled>Set status…</option>
        {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
      </select>
      <div className="flex items-center gap-1">
        <input
          value={labelInput}
          onChange={e => setLabelInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && bulkLabel()}
          placeholder="Add label…"
          className="bg-neutral-800 border border-neutral-700 text-xs text-neutral-300 rounded px-2 py-1 outline-none focus:border-blue-500 w-28"
        />
        <button onClick={bulkLabel} disabled={!labelInput.trim() || busy}
          className="text-xs px-2 py-1 bg-neutral-700 hover:bg-neutral-600 text-neutral-300 rounded transition-colors disabled:opacity-40">
          Add
        </button>
      </div>
      <button onClick={onClear} className="ml-auto text-xs text-neutral-500 hover:text-neutral-300 transition-colors">
        ✕ Clear
      </button>
    </div>
  )
}
