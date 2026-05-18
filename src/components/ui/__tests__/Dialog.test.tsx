import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('../Dialog.tsx', import.meta.url), 'utf8')

describe('Dialog primitive contract', () => {
  it('renders content through the Radix portal with an overlay', () => {
    expect(source).toContain('DialogPrimitive.Portal')
    expect(source).toContain('data-slot="dialog-overlay"')
    expect(source).toContain('DialogPrimitive.Content')
  })

  it('keeps accessible title and description wrappers', () => {
    expect(source).toContain('DialogPrimitive.Title asChild')
    expect(source).toContain('DialogPrimitive.Description asChild')
  })

  it('exports the close primitive', () => {
    expect(source).toContain('const Close = DialogPrimitive.Close')
    expect(source).toContain('Close,')
  })
})
