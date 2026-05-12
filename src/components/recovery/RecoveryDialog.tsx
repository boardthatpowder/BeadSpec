import { useEffect, useRef } from 'react'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { openPath } from '@tauri-apps/plugin-opener'
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

  if (!report) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="recovery-title"
      // Task 8.2 — no Escape, no outside-click dismissal.
      style={{ zIndex: 9999 }}
      className="fixed inset-0 bg-black/60 flex items-center justify-center"
    >
      <div className="bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl w-[560px] max-h-[80vh] flex flex-col">
        <Header />
        <Body report={report} />
        <Footer report={report} onDismiss={clearReport} />
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Header() {
  return (
    <div className="px-6 py-4 border-b border-neutral-800">
      <h2 id="recovery-title" className="text-base font-semibold text-neutral-100">
        Dolt Server Recovery Required
      </h2>
      <p className="mt-1 text-sm text-neutral-400">
        A stale Dolt SQL server was detected for this project and could not be
        recovered automatically. Choose an action below.
      </p>
    </div>
  )
}

function Body({ report }: { report: HealthReport }) {
  const healthLabel = healthSummary(report.health)

  return (
    <div className="px-6 py-4 overflow-y-auto flex-1 space-y-4">
      <div className="text-sm text-neutral-300">
        <span className="font-medium text-neutral-100">Status: </span>
        {healthLabel}
      </div>

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
  const forcing = useRef(false)

  async function handleTryAgain() {
    try {
      await unwrap(commands.probeDoltHealth(projectPath))
      onDismiss()
    } catch {
      // Still failing — dialog stays open with updated report coming via event.
    }
  }

  async function handleForce() {
    if (forcing.current) return
    forcing.current = true
    try {
      await unwrap(commands.attemptDoltRecovery(projectPath, true))
      onDismiss()
    } catch {
      // StillUnsafe — Rust will re-emit dolt-recovery-required with updated state.
    } finally {
      forcing.current = false
    }
  }

  async function handleOpenLog() {
    // Open the parent folder of recovery.log so the user can inspect it.
    // Path mirrors log_path() in recovery_log.rs; falls back to home on non-macOS.
    const macLog = `${(window as unknown as Record<string, string>).__TAURI_HOME__ ?? '~'}/Library/Logs/BeadSpec`
    await openPath(macLog).catch(() => {})
  }

  async function handleQuit() {
    // Close the main Tauri window — Tauri exits when the last window closes.
    await getCurrentWindow().close()
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
        onClick={handleTryAgain}
        className="px-3 py-1.5 text-sm bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded border border-neutral-700 transition-colors"
      >
        Try again
      </button>
      <button
        onClick={handleForce}
        className="px-3 py-1.5 text-sm bg-red-900/80 hover:bg-red-800 text-red-200 rounded border border-red-700 transition-colors"
      >
        Force kill &amp; retry
      </button>
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
  }
}
