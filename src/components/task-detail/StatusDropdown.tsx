import { useState } from 'react'
import { commands, unwrap } from '../../ipc'
import type { TaskDetail } from '../../bindings'
import { useQueryClient } from '@tanstack/react-query'
import { STATUS_PALETTE } from '../../lib/palettes'
import { useToast } from '../ui/Toast'
import { Dialog } from '../ui/Dialog'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'
import { Popover } from '../ui/Popover'

interface BlockerConfirmDialogProps {
  blockingIds: string[]
  onConfirm: () => void
  onCancel: () => void
}

function BlockerConfirmDialog({ blockingIds, onConfirm, onCancel }: BlockerConfirmDialogProps) {
  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onCancel() }}>
      <Dialog.Content className="max-w-md p-6">
        <Dialog.Header className="sr-only">Close anyway?</Dialog.Header>
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-amber-900/30 border border-amber-800/40 flex items-center justify-center flex-shrink-0">
            <Icon name="AlertTriangle" size="lg" className="text-amber-400" />
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
          <Button
            variant="secondary"
            size="xs"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            size="xs"
            onClick={onConfirm}
            className="border-amber-700/60 bg-amber-900/40 text-amber-300 hover:bg-amber-800/50 hover:text-amber-200"
          >
            Close anyway
          </Button>
        </div>
      </Dialog.Content>
    </Dialog.Root>
  )
}

interface Props {
  task: TaskDetail
  project: string
}

function statusClass(status: string) {
  const palette = STATUS_PALETTE[status] ?? STATUS_PALETTE.open
  return `${palette.bg} ${palette.text} ${palette.border}`
}

const STATUS_OPTIONS = ['open', 'in_progress', 'blocked', 'closed'] as const
type Status = typeof STATUS_OPTIONS[number]

const STATUS_ICONS: Record<Status, 'Circle' | 'Loader2' | 'Ban' | 'CheckCircle2'> = {
  open: 'Circle',
  in_progress: 'Loader2',
  blocked: 'Ban',
  closed: 'CheckCircle2',
}

function statusLabel(s: string) {
  return s.replace('_', ' ')
}

export function StatusDropdown({ task, project }: Props) {
  const [open, setOpen] = useState(false)
  const [blockerDialog, setBlockerDialog] = useState<{ ids: string[] } | null>(null)
  const queryClient = useQueryClient()
  const { toast } = useToast()

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

  const colorClass = statusClass(task.status)

  return (
    <>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <Button
            variant="ghost"
            size="xs"
            className={`h-auto gap-1 rounded-full border px-2 py-0.5 text-xs font-medium cursor-pointer hover:opacity-80 ${colorClass}`}
          >
            <Icon name={STATUS_ICONS[task.status as Status] ?? 'Circle'} size="sm" className="h-3 w-3" />
            {statusLabel(task.status)}
          </Button>
        </Popover.Trigger>

        <Popover.Content align="start" className="min-w-[130px] bg-neutral-900 py-1">
            {STATUS_OPTIONS.map(s => (
              <Button
                key={s}
                variant="ghost"
                size="xs"
                onClick={() => select(s)}
                className={`h-auto w-full justify-start rounded-none border-0 px-3 py-1.5 text-left ${s === task.status ? 'font-semibold' : ''}`}
              >
                <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 ${statusClass(s)}`}>
                  <Icon name={STATUS_ICONS[s]} size="sm" className="h-3 w-3" />
                  {statusLabel(s)}
                </span>
              </Button>
            ))}
        </Popover.Content>
      </Popover.Root>

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
