import { useState, useCallback, useEffect } from 'react'
import { commands, unwrap } from '../../ipc'
import type { CommandOutput } from '../../bindings'
import { useActiveProject } from '../../hooks/useProject'
import { renderWithChips } from '../shared/issueChips'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'
import { Tabs } from '../ui/Tabs'
import { WorkerFindingsPanel } from './WorkerFindingsPanel'
import { ProjectBackendPanel } from './ProjectBackendPanel'

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
type HealthTab = 'checks' | 'findings'

const CHECKS: CheckConfig[] = [
  { key: 'preflight', label: 'Preflight' },
  { key: 'doctor',    label: 'Doctor' },
  { key: 'lint',      label: 'Lint' },
  { key: 'stale',     label: 'Stale' },
  { key: 'orphans',   label: 'Orphans' },
]

/** Run the named bd command for a given check key. Returns stdout on success, throws on error. */
async function runNamedBdCheck(projectPath: string, key: CheckKey): Promise<string> {
  switch (key) {
    case 'preflight': return unwrap(commands.bdPreflight(projectPath))
    case 'doctor':    return unwrap(commands.bdDoctor(projectPath))
    case 'lint':      return unwrap(commands.bdLint(projectPath))
    case 'stale':     return unwrap(commands.bdStale(projectPath))
    case 'orphans':   return unwrap(commands.bdOrphans(projectPath))
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
    <div className="border border-(--color-border) rounded-lg overflow-hidden">
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggle}
        className="h-auto w-full justify-start gap-3 rounded-none border-0 bg-(--color-surface) px-4 py-3 text-left hover:bg-(--color-surface-hi)/60"
      >
        {/* Status badge */}
        <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
          {isRunning ? (
            <span className="w-3.5 h-3.5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin block" />
          ) : passed ? (
            <Icon name="Check" size="md" className="h-4 w-4 text-green-400" />
          ) : failed ? (
            <Icon name="X" size="md" className="h-4 w-4 text-red-400" />
          ) : (
            <span className="w-3 h-3 rounded-full bg-(--color-surface-hi) block" />
          )}
        </div>

        <span className="flex-1 text-sm font-medium text-(--color-fg)">{label}</span>

        {exitCode !== null && !isRunning && (
          <span className={[
            'text-[10px] font-mono px-1.5 py-0.5 rounded',
            passed ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400',
          ].join(' ')}>
            exit {exitCode}
          </span>
        )}

        {/* Chevron */}
        <Icon
          name="ChevronDown"
          size="md"
          className={['h-4 w-4 text-(--color-fg-subtle) transition-transform', open ? 'rotate-180' : ''].join(' ')}
        />
      </Button>

      {open && (
        <div className="px-4 py-3 bg-(--color-bg) border-t border-(--color-border)">
          {isRunning ? (
            <p className="text-xs text-(--color-fg-subtle) italic">Running…</p>
          ) : combinedOutput ? (
            <pre className="text-xs text-(--color-fg-muted) whitespace-pre-wrap font-mono leading-5 max-h-64 overflow-y-auto">
              {renderWithChips(combinedOutput)}
            </pre>
          ) : (
            <p className="text-xs text-(--color-fg-subtle) italic">No output.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function BdHealthPanel() {
  const project = useActiveProject()
  const [checks, setChecks] = useState<CheckState>(INITIAL_STATE)
  const [isRunning, setIsRunning] = useState(false)
  const [openSections, setOpenSections] = useState<Set<CheckKey>>(new Set())
  const [bdNotFound, setBdNotFound] = useState(false)
  const [projectNotConnected, setProjectNotConnected] = useState(false)
  const [hasRun, setHasRun] = useState(false)
  const [tab, setTab] = useState<HealthTab>('checks')

  const setCheck = useCallback((key: CheckKey, patch: Partial<CheckResult>) => {
    setChecks(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }))
  }, [])

  const runChecks = useCallback(async () => {
    if (!project || isRunning) return

    setIsRunning(true)
    setHasRun(true)
    setBdNotFound(false)
    setProjectNotConnected(false)
    setChecks(INITIAL_STATE)
    setOpenSections(new Set())

    for (const check of CHECKS) {
      setCheck(check.key, { isRunning: true, output: null, error: null })
      try {
        const stdout = await runNamedBdCheck(project, check.key)
        const output: CommandOutput = { stdout, stderr: '', exit_code: 0 }
        setCheck(check.key, { isRunning: false, output, error: null })
      } catch (err) {
        const errorMsg = typeof err === 'string' ? err : 'Unknown error'
        const isBdMissing = errorMsg.includes('bd CLI not found')
        const isNotConnected = errorMsg.includes('project_not_connected')
        const syntheticOutput: CommandOutput = { stdout: '', stderr: errorMsg, exit_code: -1 }
        setCheck(check.key, { isRunning: false, output: syntheticOutput, error: errorMsg })

        if (isBdMissing) {
          setBdNotFound(true)
          break
        }
        if (isNotConnected) {
          setProjectNotConnected(true)
          break
        }
        // Per-check failure: auto-open the section so the error is visible
        setOpenSections(prev => new Set(prev).add(check.key))
      }
    }

    setIsRunning(false)
  }, [project, isRunning, setCheck])

  // Auto-run on mount
  useEffect(() => {
    if (project && !hasRun) {
      runChecks()
    }
  }, [project, hasRun, runChecks])

  const toggleSection = useCallback((key: CheckKey) => {
    setOpenSections(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const allPassed = hasRun && !isRunning && !bdNotFound && !projectNotConnected &&
    CHECKS.every(c => checks[c.key].output?.exit_code === 0)

  if (!project) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-(--color-fg-subtle) text-sm">No project connected. Open a project first.</p>
      </div>
    )
  }

  return (
    <Tabs.Root
      value={tab}
      onValueChange={(value) => setTab(value as HealthTab)}
      className="h-full flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-(--color-border) flex-shrink-0">
        <div>
          <h2 className="text-base font-semibold text-(--color-fg)">bd Health</h2>
          <p className="text-xs text-(--color-fg-subtle) mt-0.5">Run bd diagnostics checks on the connected project</p>
        </div>
        {tab === 'checks' && (
          <Button
            variant="secondary"
            size="xs"
            onClick={runChecks}
            disabled={isRunning}
            className="border-(--color-border-strong) bg-(--color-surface-hi) text-(--color-fg-muted) hover:bg-(--color-surface-hi) hover:text-(--color-fg) disabled:text-(--color-fg-subtle)"
          >
            {isRunning ? 'Running…' : 'Re-run'}
          </Button>
        )}
      </div>

      <ProjectBackendPanel key={project} project={project} />

      <Tabs.List className="flex-shrink-0 gap-5 px-5 pt-0">
        {([
          ['checks', 'Checks'],
          ['findings', 'Worker findings'],
        ] as const).map(([value, label]) => (
          <Tabs.Trigger
            key={value}
            value={value}
            className="px-0 py-2 text-xs font-medium data-[state=active]:border-neutral-100 data-[state=active]:text-(--color-fg)"
          >
            {label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>

      {/* Body */}
      <Tabs.Content value="findings" className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
        <WorkerFindingsPanel />
      </Tabs.Content>

      <Tabs.Content value="checks" className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
        {bdNotFound ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-12 h-12 rounded-full bg-amber-900/30 border border-amber-800/40 flex items-center justify-center">
              <Icon name="AlertTriangle" size="lg" className="h-6 w-6 text-amber-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-(--color-fg)">bd CLI not configured</p>
              <p className="text-xs text-(--color-fg-subtle) mt-1 max-w-xs">
                The <code className="font-mono bg-(--color-surface-hi) px-1 rounded">bd</code> command was not found on PATH.
                Install Beads CLI and ensure it is available in your shell, then re-run.
              </p>
            </div>
          </div>
        ) : projectNotConnected ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-12 h-12 rounded-full bg-(--color-surface-hi) border border-(--color-border-strong) flex items-center justify-center">
              <Icon name="Lock" size="lg" className="h-6 w-6 text-(--color-fg-muted)" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-(--color-fg)">Project not fully connected</p>
              <p className="text-xs text-(--color-fg-subtle) mt-1 max-w-xs">
                Try reopening the project from the Project menu, then re-run.
              </p>
            </div>
          </div>
        ) : allPassed ? (
          <>
            <div className="flex items-center gap-3 px-4 py-3 bg-green-900/20 border border-green-800/40 rounded-lg">
              <Icon name="CircleCheck" size="lg" className="h-5 w-5 flex-shrink-0 text-green-400" />
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
            <p className="text-(--color-fg-subtle) text-sm">Click Re-run to start checks.</p>
          </div>
        )}
      </Tabs.Content>
    </Tabs.Root>
  )
}
