import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { JSDOM } from 'jsdom'
import { createRoot, type Root } from 'react-dom/client'
import { Dialog } from '../Dialog'

let dom: JSDOM
let root: Root | undefined
let host: HTMLDivElement

function installDom() {
  dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'http://localhost/',
  })

  globalThis.window = dom.window as unknown as Window & typeof globalThis
  globalThis.document = dom.window.document
  globalThis.HTMLElement = dom.window.HTMLElement
  globalThis.HTMLInputElement = dom.window.HTMLInputElement
  globalThis.HTMLButtonElement = dom.window.HTMLButtonElement
  globalThis.SVGElement = dom.window.SVGElement
  globalThis.Node = dom.window.Node
  globalThis.NodeFilter = dom.window.NodeFilter
  globalThis.Event = dom.window.Event
  globalThis.CustomEvent = dom.window.CustomEvent
  globalThis.MouseEvent = dom.window.MouseEvent
  globalThis.KeyboardEvent = dom.window.KeyboardEvent
  globalThis.PointerEvent = dom.window.MouseEvent as unknown as typeof PointerEvent
  globalThis.MutationObserver = dom.window.MutationObserver
  globalThis.getComputedStyle = dom.window.getComputedStyle
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  host = dom.window.document.getElementById('root') as HTMLDivElement
}

function DemoDialog() {
  return (
    <Dialog.Root>
      <Dialog.Trigger>Open dialog</Dialog.Trigger>
      <Dialog.Content>
        <Dialog.Header>Dialog title</Dialog.Header>
        <Dialog.Body>Dialog body</Dialog.Body>
        <Dialog.Footer>
          <Dialog.Close>Close</Dialog.Close>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  )
}

async function render(ui: React.ReactNode) {
  await act(async () => {
    root = createRoot(host)
    root.render(ui)
  })
}

async function click(element: Element) {
  await act(async () => {
    element.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
  })
}

describe('Dialog', () => {
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

  it('opens from the trigger', async () => {
    await render(<DemoDialog />)

    await click(document.querySelector('button') as HTMLButtonElement)

    expect(document.body.textContent).toContain('Dialog title')
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull()
  })

  it('closes on Escape', async () => {
    await render(<DemoDialog />)

    await click(document.querySelector('button') as HTMLButtonElement)
    await act(async () => {
      document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })

    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
  })

  it('closes on backdrop click', async () => {
    await render(<DemoDialog />)

    await click(document.querySelector('button') as HTMLButtonElement)
    const overlay = document.body.querySelector('[data-slot="dialog-overlay"]') as HTMLElement
    await act(async () => {
      overlay.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, cancelable: true }))
      overlay.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
    })

    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
  })
})
