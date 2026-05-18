import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { JSDOM } from 'jsdom'
import { createRoot, type Root } from 'react-dom/client'
import { Button, type ButtonVariant } from '../Button'

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
  globalThis.SVGElement = dom.window.SVGElement
  globalThis.Node = dom.window.Node
  globalThis.MouseEvent = dom.window.MouseEvent
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  host = dom.window.document.getElementById('root') as HTMLDivElement
}

function render(ui: React.ReactNode) {
  act(() => {
    root = createRoot(host)
    root.render(ui)
  })

  return host
}

describe('Button', () => {
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

  it('renders each variant', () => {
    const variants: ButtonVariant[] = ['primary', 'secondary', 'ghost', 'danger', 'link']

    const container = render(
      <>
        {variants.map((variant) => (
          <Button key={variant} variant={variant}>
            {variant}
          </Button>
        ))}
      </>,
    )

    const buttons = Array.from(container.querySelectorAll('button'))
    expect(buttons).toHaveLength(variants.length)
    expect(buttons[0].className).toContain('bg-[--color-accent]')
    expect(buttons[3].className).toContain('bg-[--color-danger]')
  })

  it('renders loading state as disabled with a spinner', () => {
    const container = render(<Button loading>Save</Button>)
    const button = container.querySelector('button')

    expect(button?.disabled).toBe(true)
    expect(button?.getAttribute('aria-busy')).toBe('true')
    expect(button?.querySelector('svg')).not.toBeNull()
  })

  it('renders disabled state as non-interactive', () => {
    const container = render(<Button disabled>Delete</Button>)
    const button = container.querySelector('button')

    expect(button?.disabled).toBe(true)
    expect(button?.className).toContain('opacity-50')
    expect(button?.className).toContain('pointer-events-none')
  })
})
