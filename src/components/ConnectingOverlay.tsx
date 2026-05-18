import { useEffect, useState } from 'react'
import { useProjectStore } from '../hooks/useProject'
import { Icon } from './ui/Icon'

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
      // Intentionally opaque backdrop; it should dim both light and dark themes.
      className="fixed inset-0 bg-[rgb(0_0_0_/_0.40)] flex items-center justify-center pointer-events-none"
    >
      <div className="bg-(--color-surface) border border-(--color-border-strong) rounded-lg shadow-xl px-6 py-5 w-[420px] pointer-events-auto">
        <div className="flex items-center gap-3">
          <Spinner />
          <div className="text-sm font-medium text-(--color-fg)">
            Connecting to {projectName}
          </div>
          <div className="ml-auto text-xs text-(--color-fg-subtle) tabular-nums">{elapsed}s</div>
        </div>
        <div className="mt-2 text-xs text-(--color-fg-muted)">{connecting.status}</div>
        <div className="mt-1 text-xs text-(--color-fg-subtle)">{detail}</div>
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <Icon
      name="LoaderCircle"
      size="lg"
      className="animate-spin text-(--color-fg-muted)"
      aria-hidden="true"
    />
  )
}
