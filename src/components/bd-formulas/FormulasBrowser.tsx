import { useState, useCallback, useEffect } from 'react'
import { commands, unwrap } from '../../ipc'
import type { CommandOutput } from '../../bindings'
import { useActiveProject } from '../../hooks/useProject'
import { renderWithChips } from '../shared/issueChips'
import { parseFormulaList } from './types'
import type { Formula } from './types'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'
import { PourConfirmDialog } from './PourConfirmDialog'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PourResult {
  output: CommandOutput
  formulaName: string
}

// ── Formula Card ──────────────────────────────────────────────────────────────

interface FormulaCardProps {
  formula: Formula
  isPouring: boolean
  pourResult: PourResult | null
  onPour: (name: string) => void
}

function FormulaCard({ formula, isPouring, pourResult, onPour }: FormulaCardProps) {
  const ownResult = pourResult?.formulaName === formula.name ? pourResult : null
  const succeeded = ownResult && ownResult.output.exit_code === 0
  const failed = ownResult && ownResult.output.exit_code !== 0
  const combinedOutput = ownResult
    ? [ownResult.output.stdout, ownResult.output.stderr].filter(Boolean).join('\n').trim()
    : null

  return (
    <div className="border border-[--color-border] rounded-lg bg-[--color-surface] overflow-hidden">
      <div className="px-4 py-3 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[--color-fg] font-mono">{formula.name}</p>
          {formula.description && (
            <p className="text-xs text-[--color-fg-muted] mt-0.5 leading-4">{formula.description}</p>
          )}
        </div>
        <Button
          variant="secondary"
          size="xs"
          onClick={() => onPour(formula.name)}
          disabled={isPouring}
          className={[
            'flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors',
            isPouring
              ? 'bg-[--color-surface-hi] text-[--color-fg-subtle] border-[--color-border-strong] cursor-not-allowed'
              : 'bg-blue-900/30 text-blue-300 border-blue-800/40 hover:bg-blue-800/50 hover:text-blue-200',
          ].join(' ')}
        >
          {isPouring && ownResult === null ? 'Waiting…' : 'Pour'}
        </Button>
      </div>

      {/* Pour output */}
      {ownResult && combinedOutput && (
        <div className={[
          'px-4 py-3 border-t',
          failed ? 'border-red-900/40 bg-red-950/20' : 'border-[--color-border] bg-[--color-bg]',
        ].join(' ')}>
          {failed && (
            <div className="flex items-center gap-1.5 mb-2">
              <Icon name="X" size="sm" className="flex-shrink-0 text-red-400" />
              <span className="text-[10px] text-red-400 font-medium">Pour failed (exit {ownResult.output.exit_code})</span>
            </div>
          )}
          {succeeded && (
            <div className="flex items-center gap-1.5 mb-2">
              <Icon name="Check" size="sm" className="flex-shrink-0 text-green-400" />
              <span className="text-[10px] text-green-400 font-medium">Pour succeeded</span>
            </div>
          )}
          <pre className="text-xs text-[--color-fg-muted] whitespace-pre-wrap font-mono leading-5 max-h-48 overflow-y-auto">
            {renderWithChips(combinedOutput)}
          </pre>
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function FormulasBrowser() {
  const project = useActiveProject()
  const [formulas, setFormulas] = useState<Formula[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [rawErrorOutput, setRawErrorOutput] = useState<string | null>(null)
  const [bdNotFound, setBdNotFound] = useState(false)
  const [isPouring, setIsPouring] = useState(false)
  const [pendingPour, setPendingPour] = useState<string | null>(null)
  const [pourResult, setPourResult] = useState<PourResult | null>(null)
  const [hasLoaded, setHasLoaded] = useState(false)

  const loadFormulas = useCallback(async () => {
    if (!project) return
    setIsLoading(true)
    setRawErrorOutput(null)
    setBdNotFound(false)
    setFormulas([])

    try {
      const stdout = await unwrap(commands.bdFormulaList(project))
      const { formulas: parsed, parseError: pe } = parseFormulaList(stdout)
      setFormulas(parsed)
      if (pe) {
        setRawErrorOutput(stdout || 'Could not parse formula list JSON')
      }
    } catch (err) {
      const msg = typeof err === 'string' ? err : 'Unknown error'
      if (msg.includes('bd CLI not found') || msg.includes('project_not_connected')) {
        setBdNotFound(true)
      } else {
        setRawErrorOutput(msg)
      }
    }

    setIsLoading(false)
    setHasLoaded(true)
  }, [project])

  // Load on mount / project change
  useEffect(() => {
    if (project && !hasLoaded) {
      loadFormulas()
    }
  }, [project, hasLoaded, loadFormulas])

  const handlePourRequest = useCallback((name: string) => {
    setPendingPour(name)
    setPourResult(null)
  }, [])

  const handlePourConfirm = useCallback(async () => {
    if (!project || !pendingPour) return
    const name = pendingPour
    setPendingPour(null)
    setIsPouring(true)

    try {
      const stdout = await unwrap(commands.bdFormulaPour(project, name))
      const output: CommandOutput = { stdout, stderr: '', exit_code: 0 }
      setPourResult({ output, formulaName: name })
    } catch (err) {
      const msg = typeof err === 'string' ? err : 'Unknown error'
      setPourResult({
        formulaName: name,
        output: { stdout: '', stderr: msg, exit_code: -1 },
      })
    }

    setIsPouring(false)
  }, [project, pendingPour])

  const handlePourCancel = useCallback(() => {
    setPendingPour(null)
  }, [])

  if (!project) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-[--color-fg-subtle] text-sm">No project connected. Open a project first.</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Confirmation dialog */}
      {pendingPour && (
        <PourConfirmDialog
          formulaName={pendingPour}
          onConfirm={handlePourConfirm}
          onCancel={handlePourCancel}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[--color-border] flex-shrink-0">
        <div>
          <h2 className="text-base font-semibold text-[--color-fg]">Formulas</h2>
          <p className="text-xs text-[--color-fg-subtle] mt-0.5">Pour bd formulas into the connected project</p>
        </div>
        <Button
          variant="secondary"
          size="xs"
          onClick={() => { setHasLoaded(false) }}
          disabled={isLoading}
          className={[
            'px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors',
            isLoading
              ? 'bg-[--color-surface-hi] text-[--color-fg-subtle] border-[--color-border-strong] cursor-not-allowed'
              : 'bg-[--color-surface-hi] text-[--color-fg-muted] border-[--color-border-strong] hover:bg-[--color-surface-hi] hover:text-[--color-fg]',
          ].join(' ')}
        >
          {isLoading ? 'Loading…' : 'Refresh'}
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <span className="w-5 h-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin block" />
          </div>
        ) : bdNotFound ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-12 h-12 rounded-full bg-amber-900/30 border border-amber-800/40 flex items-center justify-center">
              <Icon name="TriangleAlert" size="lg" className="text-amber-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-[--color-fg]">bd CLI not configured</p>
              <p className="text-xs text-[--color-fg-subtle] mt-1 max-w-xs">
                The <code className="font-mono bg-[--color-surface-hi] px-1 rounded">bd</code> command was not found on PATH.
              </p>
            </div>
          </div>
        ) : rawErrorOutput ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-4 py-3 bg-red-900/20 border border-red-800/40 rounded-lg">
              <Icon name="X" size="md" className="flex-shrink-0 text-red-400" />
              <span className="text-xs text-red-300 font-medium">Formula list unavailable</span>
            </div>
            <pre className="text-xs text-[--color-fg-muted] whitespace-pre-wrap font-mono bg-[--color-surface] border border-[--color-border] rounded-lg p-4 max-h-48 overflow-y-auto">
              {rawErrorOutput}
            </pre>
          </div>
        ) : formulas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <p className="text-sm text-[--color-fg-muted]">No formulas available</p>
            <p className="text-xs text-[--color-fg-subtle]">
              Formulas will appear here when your project has any configured.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {formulas.map(formula => (
              <FormulaCard
                key={formula.name}
                formula={formula}
                isPouring={isPouring}
                pourResult={pourResult}
                onPour={handlePourRequest}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
