import { useEffect, useState, useCallback } from 'react'
import { importChangeToBeads } from '../../ipc'
import { useActiveProject } from '../../hooks/useProject'
import { useAppState } from '../../contexts/HashStateContext'
import type { CommandOutput } from '../../bindings'
import { IconButton } from '../ui/IconButton'
import type { Task } from '../../bindings'

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-lg bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
          <h2 className="text-sm font-semibold text-neutral-100">
            Import <span className="font-mono text-blue-400">{changeName}</span> to Beads
          </h2>
          {modalState.phase !== 'running' && (
            <IconButton
              label="Close"
              onClick={onClose}
              className="text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
              </svg>
            </IconButton>
          )}
        </div>

        {/* Body */}
        <div className="px-5 py-5">
          {modalState.phase === 'running' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <span className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin block" />
              <p className="text-sm text-neutral-400">Running openspec-beads-import…</p>
            </div>
          )}

          {modalState.phase === 'not_found' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="w-10 h-10 rounded-full bg-amber-900/30 border border-amber-800/40 flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-neutral-200">openspec-beads-import not found</p>
                <p className="text-xs text-neutral-500 mt-1">
                  Run <code className="font-mono bg-neutral-800 px-1 rounded">openspec-beads-import {changeName}</code> from the terminal.
                </p>
              </div>
              <button
                onClick={onClose}
                className="mt-2 px-4 py-1.5 text-xs font-medium bg-neutral-800 text-neutral-300 border border-neutral-700 rounded-lg hover:bg-neutral-700 transition-colors"
              >
                Close
              </button>
            </div>
          )}

          {modalState.phase === 'success' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2 text-green-400">
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
                </svg>
                <span className="text-sm font-medium">Import complete</span>
              </div>
              {modalState.output.stdout && (
                <pre className="text-xs font-mono text-neutral-300 bg-neutral-950 border border-neutral-800 rounded-lg p-3 max-h-48 overflow-y-auto whitespace-pre-wrap leading-5">
                  {modalState.output.stdout}
                </pre>
              )}
              <div className="flex items-center gap-2 justify-end mt-1">
                {epic && (
                  <button
                    onClick={goToEpic}
                    className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                  >
                    View epic
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 text-xs font-medium bg-neutral-800 text-neutral-300 border border-neutral-700 rounded-lg hover:bg-neutral-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {modalState.phase === 'error' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2 text-red-400">
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z" clipRule="evenodd" />
                </svg>
                <span className="text-sm font-medium">Import failed (exit {modalState.output.exit_code})</span>
              </div>
              {(modalState.output.stderr || modalState.output.stdout) && (
                <pre className="text-xs font-mono text-red-300 bg-red-950/20 border border-red-900/40 rounded-lg p-3 max-h-48 overflow-y-auto whitespace-pre-wrap leading-5">
                  {[modalState.output.stderr, modalState.output.stdout].filter(Boolean).join('\n').trim()}
                </pre>
              )}
              <div className="flex items-center gap-2 justify-end mt-1">
                <button
                  onClick={runImport}
                  className="px-3 py-1.5 text-xs font-medium bg-neutral-800 text-neutral-300 border border-neutral-700 rounded-lg hover:bg-neutral-700 transition-colors"
                >
                  Retry
                </button>
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 text-xs font-medium bg-neutral-800 text-neutral-300 border border-neutral-700 rounded-lg hover:bg-neutral-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
