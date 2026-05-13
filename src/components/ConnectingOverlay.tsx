import { useEffect, useState } from 'react'
import { useProjectStore } from '../hooks/useProject'

export function ConnectingOverlay() {
  const connecting = useProjectStore(s => s.connecting)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!connecting) {
      setElapsed(0)
      return
    }
    const tick = () => setElapsed(Math.round((Date.now() - connecting.startedAt) / 1000))
    tick()
    const id = window.setInterval(tick, 500)
    return () => window.clearInterval(id)
  }, [connecting])

  if (!connecting) return null

  const projectName = connecting.path.split('/').filter(Boolean).pop() ?? connecting.path
  // Healthy dolt cold-starts in 1–3 s. Anything past ~5 s means we're likely
  // retrying or hitting a locked database; surface that to the user.
  const detail =
    elapsed < 3
      ? 'Starting the Dolt database server…'
      : elapsed < 10
        ? 'Taking longer than usual — still trying…'
        : elapsed < 90
          ? 'Something is wrong — retrying. Recovery dialog will appear if this fails.'
          : 'Recovery dialog should appear with diagnostics.'

  return (
    <div
      role="status"
      aria-live="polite"
      style={{ zIndex: 9000 }}
      className="fixed inset-0 bg-black/40 flex items-center justify-center pointer-events-none"
    >
      <div className="bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl px-6 py-5 w-[420px] pointer-events-auto">
        <div className="flex items-center gap-3">
          <Spinner />
          <div className="text-sm font-medium text-neutral-100">
            Connecting to {projectName}
          </div>
          <div className="ml-auto text-xs text-neutral-500 tabular-nums">{elapsed}s</div>
        </div>
        <div className="mt-2 text-xs text-neutral-400">{connecting.status}</div>
        <div className="mt-1 text-xs text-neutral-500">{detail}</div>
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <svg
      className="animate-spin text-neutral-300"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}
