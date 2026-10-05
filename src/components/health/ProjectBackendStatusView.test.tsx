import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { JSDOM } from 'jsdom'
import { expect, it, vi } from 'vitest'
import { ProjectBackendStatusView } from './ProjectBackendStatusView'
import type { ProjectBackendStatus } from '../../ipc'

it('enables journaling only after a user click and hides the opt-in for enabled projects', async () => {
  const dom = new JSDOM('<div id="root"></div>')
  globalThis.window = dom.window as unknown as Window & typeof globalThis
  globalThis.document = dom.window.document
  globalThis.HTMLElement = dom.window.HTMLElement
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  const host = document.getElementById('root')!
  const root = createRoot(host)
  const enable = vi.fn()
  const backend: ProjectBackendStatus = { project_path: '/one', read_transport: 'http', write_transport: 'cli', live_update_mode: 'disabled', journal_enabled: false, historical_coverage: 'Retained history', reason: 'Project hooks use CLI' }
  try {
    await act(async () => root.render(<ProjectBackendStatusView backend={backend} enabling={false} onEnable={enable} />))
    expect(enable).not.toHaveBeenCalled()
    expect(host.textContent).toContain('Reads: HTTP · Writes: CLI')
    expect(host.textContent).toContain('Project hooks use CLI')
    expect(host.textContent).toContain('journal configuration')
    await act(async () => host.querySelector('button')!.click())
    expect(enable).toHaveBeenCalledTimes(1)
    await act(async () => root.render(<ProjectBackendStatusView backend={{ ...backend, journal_enabled: true, live_update_mode: 'streaming' }} enabling={false} onEnable={enable} />))
    expect(host.querySelector('button')).toBeNull()
    expect(host.textContent).toContain('streaming')
  } finally {
    await act(async () => root.unmount())
    dom.window.close()
  }
})
