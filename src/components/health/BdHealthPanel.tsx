import { useState, useCallback, useEffect } from 'react'
import { commands, unwrap } from '../../ipc'
import type { CommandOutput } from '../../bindings'
import { useActiveProject, useActiveProjectId } from '../../hooks/useProject'
import { renderWithChips } from '../shared/issueChips'

// ── Types ─────────────────────────────────────────────────────────────────────

type CheckKey = 'preflight' | 'doctor' | 'lint' | 'stale' | 'orphans'

interface CheckConfig {
  key: CheckKey
  label: string
}

interface CheckResult {
  output: CommandOutput | null
  isRunning: boolean
  error: string | null
}

type CheckState = Record<CheckKey, CheckResult>

const CHECKS: CheckConfig[] = [
  { key: 'preflight', label: 'Preflight' },
  { key: 'doctor',    label: 'Doctor' },
  { key: 'lint',      label: 'Lint' },
  { key: 'stale',     label: 'Stale' },
  { key: 'orphans',   label: 'Orphans' },
]

/** Run the named bd command for a given check key. Returns stdout on success, throws on error. */
async function runNamedBdCheck(projectId: string, key: CheckKey): Promise<string> {
  switch (key) {
    case 'preflight': return unwrap(commands.bdPreflight(projectId))
    case 'doctor':    return unwrap(commands.bdDoctor(projectId))
    case 'lint':      return unwrap(commands.bdLint(projectId))
    case 'stale':     return unwrap(commands.bdStale(projectId))
    case 'orphans':   return unwrap(commands.bdOrphans(projectId))
  }
}

const INITIAL_STATE: CheckState = Object.fromEntries(
  CHECKS.map(c => [c.key, { output: null, isRunning: false, error: null }])
) as CheckState

// ── Sub-components ────────────────────────────────────────────────────────────

interface CheckSectionProps {
  label: string
  result: CheckResult
  open: boolean
  onToggle: () => void
}

function CheckSection({ label, result, open, onToggle }: CheckSectionProps) {
  const { output, isRunning } = result
  const exitCode = output?.exit_code ?? null
  const passed = exitCode === 0
  const failed = exitCode !== null && exitCode !== 0

  const combinedOutput = [output?.stdout, output?.stderr].filter(Boolean).join('\n').trim()

  return (
    <div className="border border-neutral-800 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 bg-neutral-900 hover:bg-neutral-800/60 transition-colors text-left"
      >
        {/* Status badge */}
        <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
          {isRunning ? (
            <span className="w-3.5 h-3.5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin block" />
          ) : passed ? (
            <svg className="w-4 h-4 text-green-400" viewBox="0 0 16 16" fill="currentColor">
              <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
            </svg>
          ) : failed ? (
            <svg className="w-4 h-4 text-red-400" viewBox="0 0 16 16" fill="currentColor">
              <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
            </svg>
          ) : (
            <span className="w-3 h-3 rounded-full bg-neutral-700 block" />
          )}
        </div>

        <span className="flex-1 text-sm font-medium text-neutral-200">{label}</span>

        {exitCode !== null && !isRunning && (
          <span className={[
            'text-[10px] font-mono px-1.5 py-0.5 rounded',
            passed ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400',
          ].join(' ')}>
            exit {exitCode}
          </span>
        )}

        {/* Chevron */}
        <svg
          className={['w-4 h-4 text-neutral-500 transition-transform', open ? 'rotate-180' : ''].join(' ')}
          viewBox="0 0 16 16" fill="currentColor"
        >
          <path d="M4.427 6.427a.75.75 0 0 1 1.06 0L8 8.939l2.513-2.512a.75.75 0 0 1 1.06 1.061L8.53 10.53a.75.75 0 0 1-1.06 0L4.427 7.488a.75.75 0 0 1 0-1.061Z" />
        </svg>
      </button>

      {open && (
        <div className="px-4 py-3 bg-neutral-950 border-t border-neutral-800">
          {isRunning ? (
            <p className="text-xs text-neutral-500 italic">Running…</p>
          ) : combinedOutput ? (
            <pre className="text-xs text-neutral-300 whitespace-pre-wrap font-mono leading-5 max-h-64 overflow-y-auto">
              {renderWithChips(combinedOutput)}
            </pre>
          ) : (
            <p className="text-xs text-neutral-500 italic">No output.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function BdHealthPanel() {
  const project = useActiveProject()
  const projectId = useActiveProjectId()
  const [checks, setChecks] = useState<CheckState>(INITIAL_STATE)
  const [isRunning, setIsRunning] = useState(false)
  const [openSections, setOpenSections] = useState<Set<CheckKey>>(new Set())
  const [bdNotFound, setBdNotFound] = useState(false)
  const [hasRun, setHasRun] = useState(false)

  const setCheck = useCallback((key: CheckKey, patch: Partial<CheckResult>) => {
    setChecks(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }))
  }, [])

  const runChecks = useCallback(async () => {
    if (!project || !projectId || isRunning) return

    setIsRunning(true)
    setHasRun(true)
    setBdNotFound(false)
    setChecks(INITIAL_STATE)

    let foundNotFound = false

    for (const check of CHECKS) {
      setCheck(check.key, { isRunning: true, output: null, error: null })
      try {
        const stdout = await runNamedBdCheck(projectId, check.key)
        const output: CommandOutput = { stdout, stderr: '', exit_code: 0 }
        setCheck(check.key, { isRunning: false, output, error: null })
      } catch (err) {
        const errorMsg = typeof err === 'string' ? err : 'Unknown error'
        const isMissing = errorMsg.toLowerCase().includes('not found') ||
          errorMsg.includes('bd cli not found') ||
          errorMsg.includes('project_not_connected')
        const syntheticOutput: CommandOutput = { stdout: '', stderr: errorMsg, exit_code: -1 }
        setCheck(check.key, { isRunning: false, output: syntheticOutput, error: errorMsg })

        if (isMissing) {
          foundNotFound = true
          setBdNotFound(true)
          break
        }
      }
    }

    if (foundNotFound) {
      // Mark remaining checks as not-run
      for (const check of CHECKS) {
        setChecks(prev => {
          if (!prev[check.key].output && !prev[check.key].isRunning) {
            return prev
          }
          return prev
        })
      }
    }

    setIsRunning(false)
  }, [project, projectId, isRunning, setCheck])

  // Auto-run on mount
  useEffect(() => {
    if (project && projectId && !hasRun) {
      runChecks()
    }
  }, [project, projectId, hasRun, runChecks])

  const toggleSection = useCallback((key: CheckKey) => {
    setOpenSections(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const allPassed = hasRun && !isRunning && !bdNotFound &&
    CHECKS.every(c => checks[c.key].output?.exit_code === 0)

  if (!project) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-neutral-500 text-sm">No project connected. Open a project first.</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800 flex-shrink-0">
        <div>
          <h2 className="text-base font-semibold text-neutral-100">bd Health</h2>
          <p className="text-xs text-neutral-500 mt-0.5">Run bd diagnostics checks on the connected project</p>
        </div>
        <button
          onClick={runChecks}
          disabled={isRunning}
          className={[
            'px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors',
            isRunning
              ? 'bg-neutral-800 text-neutral-500 border-neutral-700 cursor-not-allowed'
              : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-700 hover:text-neutral-100',
          ].join(' ')}
        >
          {isRunning ? 'Running…' : 'Re-run'}
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
        {bdNotFound ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-12 h-12 rounded-full bg-amber-900/30 border border-amber-800/40 flex items-center justify-center">
              <svg className="w-6 h-6 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-neutral-200">bd CLI not configured</p>
              <p className="text-xs text-neutral-500 mt-1 max-w-xs">
                The <code className="font-mono bg-neutral-800 px-1 rounded">bd</code> command was not found on PATH.
                Install Beads CLI and ensure it is available in your shell, then re-run.
              </p>
            </div>
          </div>
        ) : allPassed ? (
          <>
            <div className="flex items-center gap-3 px-4 py-3 bg-green-900/20 border border-green-800/40 rounded-lg">
              <svg className="w-5 h-5 text-green-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium text-green-300">All checks passed</span>
            </div>
            {/* Still show collapsed sections for reference */}
            {CHECKS.map(check => (
              <CheckSection
                key={check.key}
                label={check.label}
                result={checks[check.key]}
                open={openSections.has(check.key)}
                onToggle={() => toggleSection(check.key)}
              />
            ))}
          </>
        ) : (
          CHECKS.map(check => (
            <CheckSection
              key={check.key}
              label={check.label}
              result={checks[check.key]}
              open={openSections.has(check.key)}
              onToggle={() => toggleSection(check.key)}
            />
          ))
        )}

        {!hasRun && !isRunning && (
          <div className="flex items-center justify-center py-16">
            <p className="text-neutral-600 text-sm">Click Re-run to start checks.</p>
          </div>
        )}
      </div>
    </div>
  )
}
