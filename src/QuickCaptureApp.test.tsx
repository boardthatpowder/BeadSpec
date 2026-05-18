import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { JSDOM } from 'jsdom'
import { createRoot, type Root } from 'react-dom/client'
import QuickCaptureApp from './QuickCaptureApp'

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: vi.fn(() => ({
    hide: vi.fn(async () => {}),
    onFocusChanged: vi.fn(async () => vi.fn()),
  })),
}))

vi.mock('@tauri-apps/api/event', () => ({
  emitTo: vi.fn(async () => {}),
  listen: vi.fn(async () => vi.fn()),
}))

vi.mock('@tauri-apps/plugin-store', () => ({
  load: vi.fn(async (file: string) => ({
    get: vi.fn(async (key: string) => {
      if (file === 'settings.json' && key === 'settings') return { theme: 'light' }
      if (file === 'app.json' && key === 'last-active-project') return null
      return null
    }),
    set: vi.fn(async () => {}),
    save: vi.fn(async () => {}),
  })),
}))

vi.mock('./bindings', () => ({
  commands: {
    addLabel: vi.fn(),
    createTask: vi.fn(),
    getWorkspaceContext: vi.fn(),
  },
}))

let dom: JSDOM
let root: Root | undefined
let host: HTMLDivElement

function installDom() {
  dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'http://localhost/quick-capture.html',
  })

  globalThis.window = dom.window as unknown as Window & typeof globalThis
  globalThis.document = dom.window.document
  globalThis.HTMLElement = dom.window.HTMLElement
  globalThis.SVGElement = dom.window.SVGElement
  globalThis.Node = dom.window.Node
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

  Object.defineProperty(dom.window, 'matchMedia', {
    configurable: true,
    value: vi.fn((): MediaQueryList => ({
      media: '(prefers-color-scheme: dark)',
      matches: true,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })

  host = dom.window.document.getElementById('root') as HTMLDivElement
}

describe('QuickCaptureApp theme', () => {
  beforeEach(() => {
    installDom()
  })

  afterEach(() => {
    if (root) {
      act(() => root?.unmount())
    }
    root = undefined
    dom.window.close()
  })

  it('applies the stored light theme in the quick capture window', async () => {
    await act(async () => {
      root = createRoot(host)
      root.render(<QuickCaptureApp />)
    })

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(host.textContent).toContain('No active project')
    expect(host.firstElementChild?.className).toContain('bg-(--color-surface)')
  })
})
