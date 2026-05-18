import type { MemoryEntry } from '../../bindings'

export function buildNamespaceTree(entries: MemoryEntry[]) {
  const counts = new Map<string, number>()
  for (const entry of entries) {
    const parts = entry.key.split('|')
    let path = ''
    for (const part of parts) {
      path = path ? `${path}|${part}` : part
      counts.set(path, (counts.get(path) ?? 0) + 1)
    }
  }
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b))
}
