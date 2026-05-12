import { useState, useRef, useEffect } from 'react'
import { commands, unwrap } from '../../ipc'
import type { TaskDetail } from '../../bindings'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '../ui/Toast'

interface BlockerConfirmDialogProps {
  blockingIds: string[]
  onConfirm: () => void
  onCancel: () => void
}

function BlockerConfirmDialog({ blockingIds, onConfirm, onCancel }: BlockerConfirmDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-amber-900/30 border border-amber-800/40 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-neutral-100">Close anyway?</h3>
            <p className="mt-1 text-xs text-neutral-400">
              This issue is blocked by open {blockingIds.length === 1 ? 'issue' : 'issues'}:
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {blockingIds.map(id => (
                <code key={id} className="font-mono bg-neutral-800 px-1.5 py-0.5 rounded text-neutral-200 text-xs">
                  {id}
                </code>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3.5 py-1.5 text-xs font-medium rounded-lg border border-neutral-700
              bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-neutral-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-3.5 py-1.5 text-xs font-medium rounded-lg border border-amber-700/60
              bg-amber-900/40 text-amber-300 hover:bg-amber-800/50 hover:text-amber-200 transition-colors"
          >
            Close anyway
          </button>
        </div>
      </div>
    </div>
  )
}

interface Props {
  task: TaskDetail
  project: string
}

const STATUS_COLORS: Record<string, string> = {
  open:        'bg-neutral-700 text-neutral-300',
  in_progress: 'bg-blue-900/60 text-blue-300',
  blocked:     'bg-amber-900/60 text-amber-300',
  closed:      'bg-green-900/60 text-green-300',
}

const STATUS_OPTIONS = ['open', 'in_progress', 'blocked', 'closed'] as const
type Status = typeof STATUS_OPTIONS[number]

function statusLabel(s: string) {
  return s.replace('_', ' ')
}

export function StatusDropdown({ task, project }: Props) {
  const [open, setOpen] = useState(false)
  const [blockerDialog, setBlockerDialog] = useState<{ ids: string[] } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()
  const { toast } = useToast()

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const doChange = async (status: Status, force: boolean) => {
    const previousData = queryClient.getQueryData(['task', project, task.id])
    queryClient.setQueryData(['task', project, task.id], (old: any) => ({ ...old, status }))
    try {
      await unwrap(commands.changeTaskStatus(project, task.id, status, force))
    } catch (err) {
      queryClient.setQueryData(['task', project, task.id], previousData)
      const msg = String(err)
      const m = status === 'closed' && !force
        ? msg.match(/blocked by open issues \[([^\]]+)\]/)
        : null
      if (m) {
        const ids = m[1].split(',').map(s => s.trim()).filter(Boolean)
        setBlockerDialog({ ids })
      } else {
        toast(`Failed to update status: ${msg}`)
      }
    }
  }

  const select = (status: Status) => {
    setOpen(false)
    if (status === task.status) return
    doChange(status, false)
  }

  const colorClass = STATUS_COLORS[task.status] ?? STATUS_COLORS.open

  return (
    <>
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen(o => !o)}
          className={`text-xs px-2 py-0.5 rounded-full font-medium cursor-pointer
                      hover:opacity-80 transition-opacity ${colorClass}`}
        >
          {statusLabel(task.status)}
        </button>

        {open && (
          <div className="absolute left-0 top-full mt-1 z-50 min-w-[130px]
                          bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl py-1">
            {STATUS_OPTIONS.map(s => (
              <button
                key={s}
                onClick={() => select(s)}
                className={`w-full text-left px-3 py-1.5 text-xs transition-colors
                            hover:bg-neutral-800 ${s === task.status ? 'font-semibold' : ''}
                            ${STATUS_COLORS[s] ? '' : ''}`}
              >
                <span className={`px-1.5 py-0.5 rounded-full ${STATUS_COLORS[s] ?? ''}`}>
                  {statusLabel(s)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {blockerDialog && (
        <BlockerConfirmDialog
          blockingIds={blockerDialog.ids}
          onConfirm={() => { setBlockerDialog(null); doChange('closed', true) }}
          onCancel={() => setBlockerDialog(null)}
        />
      )}
    </>
  )
}
