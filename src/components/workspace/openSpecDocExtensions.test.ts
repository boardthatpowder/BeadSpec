import { describe, expect, it } from 'vitest'
import { createOpenSpecDocExtensions } from './openSpecDocExtensions'

describe('createOpenSpecDocExtensions', () => {
  it('installs the render-only symbol mention extension for OpenSpec documents', () => {
    const extensions = createOpenSpecDocExtensions('/repo')

    expect(extensions.map(extension => extension.name)).toContain('symbolMentionMark')
  })
})
