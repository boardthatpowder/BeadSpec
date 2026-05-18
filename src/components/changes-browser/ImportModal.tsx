import { useEffect, useState, useCallback } from 'react'
import { importChangeToBeads } from '../../ipc'
import { useActiveProject } from '../../hooks/useProject'
import { useAppState } from '../../contexts/HashStateContext'
import type { CommandOutput } from '../../bindings'
import { IconButton } from '../ui/IconButton'
import type { Task } from '../../bindings'
import { Dialog } from '../ui/Dialog'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'

interface ImportModalProps {
  changeName: string
  changeSlug: string
  onClose: () => void
  allTasks: Task[]
}

type ModalState =
  | { phase: 'running' }
  | { phase: 'success'; output: CommandOutput }
  | { phase: 'error'; output: CommandOutput }
  | { phase: 'not_found' }

export function ImportModal({ changeName, changeSlug, onClose, allTasks }: ImportModalProps) {
  const project = useActiveProject()
  const { setState } = useAppState()
  const [modalState, setModalState] = useState<ModalState>({ phase: 'running' })

  const runImport = useCallback(async () => {
    if (!project) {
      setModalState({ phase: 'not_found' })
      return
    }
    setModalState({ phase: 'running' })
    try {
      const output = await importChangeToBeads(project, changeName)
      if (output.exit_code === 0) {
        setModalState({ phase: 'success', output })
      } else {
        setModalState({ phase: 'error', output })
      }
    } catch (err) {
      const msg = typeof err === 'string' ? err : String(err)
      const isNotFound =
        msg.toLowerCase().includes('not found') ||
        msg.toLowerCase().includes('no such file')
      if (isNotFound) {
        setModalState({ phase: 'not_found' })
      } else {
        setModalState({
          phase: 'error',
          output: { stdout: '', stderr: msg, exit_code: -1 },
        })
      }
    }
  }, [project, changeName])

  useEffect(() => {
    runImport()
  }, [runImport])

  // Find the newly-created epic after import (match on slug, not the dir name)
  const epic = allTasks.find(
    t =>
      t.task_type === 'epic' &&
      t.labels.some(l => l === `openspec:${changeSlug}`)
  )

  function goToEpic() {
    if (epic) {
      setState({ view: 'all', taskId: epic.id })
    }
    onClose()
  }

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose() }}>
      <Dialog.Content className="max-w-lg p-0">
        {/* Header */}
        <Dialog.Header className="flex items-center justify-between text-sm">
          <span>
            Import <span className="font-mono text-blue-400">{changeName}</span> to Beads
          </span>
          {modalState.phase !== 'running' && (
            <IconButton
              label="Close"
              onClick={onClose}
              className="text-[--color-fg-subtle] hover:text-[--color-fg-muted] transition-colors"
            >
              <Icon name="X" size="sm" />
            </IconButton>
          )}
        </Dialog.Header>

        {/* Body */}
        <Dialog.Body className="px-5 py-5">
          {modalState.phase === 'running' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <span className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin block" />
              <p className="text-sm text-[--color-fg-muted]">Running openspec-beads-import…</p>
            </div>
          )}

          {modalState.phase === 'not_found' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="w-10 h-10 rounded-full bg-amber-900/30 border border-amber-800/40 flex items-center justify-center">
                <Icon name="AlertTriangle" size="lg" className="text-amber-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-[--color-fg]">openspec-beads-import not found</p>
                <p className="text-xs text-[--color-fg-subtle] mt-1">
                  Run <code className="font-mono bg-[--color-surface-hi] px-1 rounded">openspec-beads-import {changeName}</code> from the terminal.
                </p>
              </div>
              <Button
                variant="secondary"
                size="xs"
                onClick={onClose}
                className="mt-2"
              >
                Close
              </Button>
            </div>
          )}

          {modalState.phase === 'success' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2 text-green-400">
                <Icon name="CircleCheck" size="lg" className="flex-shrink-0" />
                <span className="text-sm font-medium">Import complete</span>
              </div>
              {modalState.output.stdout && (
                <pre className="text-xs font-mono text-[--color-fg-muted] bg-[--color-bg] border border-[--color-border] rounded-lg p-3 max-h-48 overflow-y-auto whitespace-pre-wrap leading-5">
                  {modalState.output.stdout}
                </pre>
              )}
              <div className="flex items-center gap-2 justify-end mt-1">
                {epic && (
                  <Button
                    variant="primary"
                    size="xs"
                    onClick={goToEpic}
                  >
                    View epic
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="xs"
                  onClick={onClose}
                >
                  Close
                </Button>
              </div>
            </div>
          )}

          {modalState.phase === 'error' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2 text-red-400">
                <Icon name="CircleX" size="lg" className="flex-shrink-0" />
                <span className="text-sm font-medium">Import failed (exit {modalState.output.exit_code})</span>
              </div>
              {(modalState.output.stderr || modalState.output.stdout) && (
                <pre className="text-xs font-mono text-red-300 bg-red-950/20 border border-red-900/40 rounded-lg p-3 max-h-48 overflow-y-auto whitespace-pre-wrap leading-5">
                  {[modalState.output.stderr, modalState.output.stdout].filter(Boolean).join('\n').trim()}
                </pre>
              )}
              <div className="flex items-center gap-2 justify-end mt-1">
                <Button
                  variant="secondary"
                  size="xs"
                  onClick={runImport}
                >
                  Retry
                </Button>
                <Button
                  variant="secondary"
                  size="xs"
                  onClick={onClose}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </Dialog.Body>
      </Dialog.Content>
    </Dialog.Root>
  )
}
