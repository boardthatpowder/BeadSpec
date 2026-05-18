import { describe, expect, it } from 'vitest'
import { extractCandidateSymbols } from './SymbolMentionMark'

describe('extractCandidateSymbols', () => {
  it('extracts backticks, camel case, and snake case with stoplist filtering', () => {
    expect(extractCandidateSymbols('`lookup_symbols` DescriptionEditor useEffect do_thing ab_c')).toEqual([
      'lookup_symbols',
      'DescriptionEditor',
      'do_thing',
    ])
  })

  it('ignores plain words and all caps', () => {
    expect(extractCandidateSymbols('plain FOO bar')).toEqual([])
  })
})
