import { useEffect, useRef, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { revealItemInDir } from '@tauri-apps/plugin-opener'
import { homeDir } from '@tauri-apps/api/path'
import { commands, unwrap } from '../../ipc'
import type { HealthReport, OrphanInfo } from '../../bindings'
import { useRecoveryStore } from './recoveryStore'

// ── Public component ──────────────────────────────────────────────────────────

export function RecoveryDialog() {
  const { report, setReport, clearReport } = useRecoveryStore()

  // Listen for the dolt-recovery-required event from Rust.
  useEffect(() => {
    const unlisten = listen<HealthReport>('dolt-recovery-required', (event) => {
      setReport(event.payload)
    })
    return () => { unlisten.then(fn => fn()) }
  }, [setReport])

  // Escape key dismisses — emergency exit if buttons stop working.
  useEffect(() => {
    if (!report) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') clearReport()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [report, clearReport])

  if (!report) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="recovery-title"
      style={{ zIndex: 9999 }}
      className="fixed inset-0 bg-black/60 flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) clearReport() }}
    >
      <div className="bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl w-[560px] max-h-[80vh] flex flex-col">
        <Header onDismiss={clearReport} />
        <Body report={report} />
        <Footer report={report} onDismiss={clearReport} />
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Header({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="px-6 py-4 border-b border-neutral-800 flex items-start justify-between">
      <div>
        <h2 id="recovery-title" className="text-base font-semibold text-neutral-100">
          Dolt Server Recovery Required
        </h2>
        <p className="mt-1 text-sm text-neutral-400">
          A stale Dolt SQL server was detected for this project and could not be
          recovered automatically. Choose an action below.
        </p>
      </div>
      <button
        aria-label="Close"
        onClick={onDismiss}
        className="ml-4 px-2 py-1 text-neutral-400 hover:text-neutral-100 transition-colors"
      >
        ×
      </button>
    </div>
  )
}

function Body({ report }: { report: HealthReport }) {
  const healthLabel = healthSummary(report.health)
  const stderrTail =
    report.health.kind === 'spawn_failed' ? report.health.stderr_tail : ''

  return (
    <div className="px-6 py-4 overflow-y-auto flex-1 space-y-4">
      <div className="text-sm text-neutral-300">
        <span className="font-medium text-neutral-100">Status: </span>
        {healthLabel}
      </div>

      {stderrTail && (
        <div>
          <div className="text-xs font-medium text-neutral-300 mb-1">
            dolt stderr (last lines)
          </div>
          <pre className="text-xs text-neutral-400 bg-neutral-950 border border-neutral-800 rounded p-2 max-h-[200px] overflow-auto whitespace-pre-wrap font-mono">
            {stderrTail}
          </pre>
        </div>
      )}

      {report.orphans.length > 0 && (
        <table className="w-full text-xs text-neutral-400 border border-neutral-800 rounded">
          <thead>
            <tr className="bg-neutral-800/60 text-neutral-300">
              <th className="px-3 py-2 text-left font-medium">PID</th>
              <th className="px-3 py-2 text-left font-medium">Port</th>
              <th className="px-3 py-2 text-left font-medium">Data dir</th>
              <th className="px-3 py-2 text-left font-medium">Safety</th>
            </tr>
          </thead>
          <tbody>
            {report.orphans.map((o) => (
              <OrphanRow key={o.pid} orphan={o} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function OrphanRow({ orphan }: { orphan: OrphanInfo }) {
  const safetyLabel =
    orphan.safety.decision === 'allowed'
      ? <span className="text-green-500">Safe</span>
      : <span className="text-amber-400" title={orphan.safety.reason}>Unsafe</span>

  return (
    <tr className="border-t border-neutral-800">
      <td className="px-3 py-2 font-mono">{orphan.pid}</td>
      <td className="px-3 py-2 font-mono">{orphan.port ?? '—'}</td>
      <td className="px-3 py-2 font-mono truncate max-w-[200px]" title={orphan.data_dir}>
        {orphan.data_dir}
      </td>
      <td className="px-3 py-2">{safetyLabel}</td>
    </tr>
  )
}

function Footer({ report, onDismiss }: { report: HealthReport; onDismiss: () => void }) {
  const projectPath = report.project_path
  const isSpawnFailure = report.health.kind === 'spawn_failed'
  const [busy, setBusy] = useState<null | 'retry' | 'force'>(null)
  const inFlight = useRef(false)

  async function handleRetry() {
    if (inFlight.current) return
    inFlight.current = true
    setBusy('retry')
    try {
      await unwrap(commands.retryConnectProject(projectPath))
      onDismiss()
    } catch {
      // Rust re-emits dolt-recovery-required with fresh state; listener replaces report.
    } finally {
      inFlight.current = false
      setBusy(null)
    }
  }

  async function handleForce() {
    if (inFlight.current) return
    inFlight.current = true
    setBusy('force')
    try {
      const result = await unwrap(commands.attemptDoltRecovery(projectPath, true))
      if (result.outcome === 'success') {
        // Orphans killed — kick the connect flow so the user doesn't have to
        // manually re-select the project. retry_connect_project invalidates
        // the half-spawned registry entry before calling connect_project.
        try {
          await unwrap(commands.retryConnectProject(projectPath))
          onDismiss()
        } catch {
          // Re-connect failed despite kill — Rust re-emits with the new state.
        }
      }
      // 'still_unsafe' / 'error' → Rust re-emits; listener replaces report.
    } catch {
      // genuine RPC error — keep dialog open
    } finally {
      inFlight.current = false
      setBusy(null)
    }
  }

  async function handleOpenLog() {
    // Path mirrors log_path() in recovery_log.rs.
    try {
      const home = await homeDir()
      const logPath = `${home}/Library/Logs/BeadSpec/recovery.log`
      await revealItemInDir(logPath)
    } catch (e) {
      console.error('Failed to open recovery log:', e)
    }
  }

  async function handleQuit() {
    // `destroy()` bypasses the CloseRequested handler in lib.rs which can veto
    // a plain `close()` call. Tauri exits when the last window is destroyed.
    try {
      await getCurrentWindow().destroy()
    } catch (e) {
      console.error('Failed to quit:', e)
    }
  }

  return (
    <div className="px-6 py-4 border-t border-neutral-800 flex gap-2 justify-end">
      <button
        onClick={handleOpenLog}
        className="px-3 py-1.5 text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
      >
        Open recovery log
      </button>
      <button
        onClick={handleQuit}
        className="px-3 py-1.5 text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
      >
        Quit app
      </button>
      <button
        onClick={handleRetry}
        disabled={busy !== null}
        className="px-3 py-1.5 text-sm bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded border border-neutral-700 transition-colors disabled:opacity-60 disabled:cursor-wait"
      >
        {busy === 'retry' ? 'Retrying…' : 'Retry'}
      </button>
      {!isSpawnFailure && (
        <button
          onClick={handleForce}
          disabled={busy !== null}
          className="px-3 py-1.5 text-sm bg-red-900/80 hover:bg-red-800 text-red-200 rounded border border-red-700 transition-colors disabled:opacity-60 disabled:cursor-wait"
        >
          {busy === 'force' ? 'Killing…' : 'Force kill & retry'}
        </button>
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function healthSummary(health: HealthReport['health']): string {
  switch (health.kind) {
    case 'ok': return 'Server is healthy.'
    case 'not_running': return 'No Dolt server is running for this project.'
    case 'port_bound_but_not_responding':
      return `Port is occupied but not responding to SQL (orphan PID: ${health.pid ?? 'unknown'}).`
    case 'port_unbound_but_orphan_running':
      return `An orphan Dolt server is running on port ${health.port} (PID ${health.pid}).`
    case 'foreign_process_holding_port':
      return `A non-Dolt process (${health.exe}, PID ${health.pid}) is holding the configured port.`
    case 'spawn_failed':
      return `Could not start the Dolt sidecar after ${health.attempts} attempts: ${health.last_error}`
  }
}
