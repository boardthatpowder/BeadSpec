export interface MemoryFacets {
  raw: string
  branch?: string
  worktree?: string
  repo?: string
  openspec?: string
  issue?: string
  type?: string
  outcome?: string
  ts?: number
  rest: Record<string, string>
}

export function parseMemoryKey(key: string): MemoryFacets {
  const facets: MemoryFacets = { raw: key, rest: {} }
  for (const segment of key.split('|')) {
    const idx = segment.indexOf(':')
    if (idx <= 0) continue
    const name = segment.slice(0, idx)
    const value = segment.slice(idx + 1)
    if (name === 'ts') {
      const n = Number(value)
      if (Number.isFinite(n)) facets.ts = n
      else facets.rest[name] = value
      continue
    }
    if (['branch', 'worktree', 'repo', 'openspec', 'issue', 'type', 'outcome'].includes(name)) {
      ;(facets as unknown as Record<string, string>)[name] = value
    } else {
      facets.rest[name] = value
    }
  }
  return facets
}
