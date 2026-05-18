import { describe, expect, it } from 'vitest'
import { extractDiffSymbols } from './extractDiffSymbols'

describe('extractDiffSymbols', () => {
  it('extracts mixed declaration symbols and caps at ten', () => {
    const diff = [
      '+export function loadThing() {}',
      '+const saveThing = async () => {}',
      '+pub fn run_task() {}',
      '-pub fn run_task() {}',
      '+def parse_item(): pass',
      '+class Widget {}',
      '+const a1 = () => {}',
      '+const a2 = () => {}',
      '+const a3 = () => {}',
      '+const a4 = () => {}',
      '+const a5 = () => {}',
      '+const a6 = () => {}',
      '+const a7 = () => {}',
    ].join('\n')
    const symbols = extractDiffSymbols(diff)
    expect(symbols).toContain('loadThing')
    expect(symbols).toContain('run_task')
    expect(symbols).toHaveLength(10)
  })

  it('ignores non-declaration lines', () => {
    expect(extractDiffSymbols('+console.log(loadThing)\n-context')).toEqual([])
  })
})
