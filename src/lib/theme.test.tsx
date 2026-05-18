import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { JSDOM } from 'jsdom'
import { createRoot, type Root } from 'react-dom/client'
import { resolveTheme, useThemeEffect } from './theme'
import type { AppSettings } from '../stores/settingsStore'

let dom: JSDOM
let root: Root | undefined
let host: HTMLDivElement
let prefersDark = false
let listeners: Array<(event: MediaQueryListEvent) => void> = []

function installDom() {
  dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'http://localhost/',
  })

  globalThis.window = dom.window as unknown as Window & typeof globalThis
  globalThis.document = dom.window.document
  globalThis.HTMLElement = dom.window.HTMLElement
  globalThis.Node = dom.window.Node
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

  listeners = []
  prefersDark = false
  Object.defineProperty(dom.window, 'matchMedia', {
    configurable: true,
    value: vi.fn((media: string): MediaQueryList => ({
      media,
      matches: prefersDark,
      onchange: null,
      addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
        listeners.push(listener as (event: MediaQueryListEvent) => void)
      },
      removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
        listeners = listeners.filter(existing => existing !== listener)
      },
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })

  host = dom.window.document.getElementById('root') as HTMLDivElement
}

function renderTheme(theme: AppSettings['theme']) {
  act(() => {
    if (!root) root = createRoot(host)
    root.render(<ThemeProbe theme={theme} />)
  })
}

function setSystemPreference(nextPrefersDark: boolean) {
  prefersDark = nextPrefersDark
  act(() => {
    for (const listener of listeners) {
      listener({ matches: nextPrefersDark } as MediaQueryListEvent)
    }
  })
}

function ThemeProbe({ theme }: { theme: AppSettings['theme'] }) {
  useThemeEffect(theme)
  return null
}

describe('theme utilities', () => {
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

  it('resolves system theme from OS preference', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('applies explicit themes to documentElement', () => {
    renderTheme('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')

    renderTheme('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('updates system theme when the OS preference changes', () => {
    prefersDark = true
    renderTheme('system')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')

    setSystemPreference(false)
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('stops listening to OS changes after switching to an explicit theme', () => {
    renderTheme('system')
    expect(listeners).toHaveLength(1)

    renderTheme('light')
    expect(listeners).toHaveLength(0)

    setSystemPreference(true)
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })
})
