const DECLARATION_PATTERNS = [
  /\b(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g,
  /\bclass\s+([A-Za-z_$][\w$]*)/g,
  /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/g,
  /^\s*(?:pub\s+)?fn\s+([A-Za-z_][\w]*)/g,
  /^\s*(?:pub\s+)?struct\s+([A-Za-z_][\w]*)/g,
  /^\s*(?:async\s+)?def\s+([A-Za-z_][\w]*)/g,
  /^\s*class\s+([A-Za-z_][\w]*)/g,
]

export function extractDiffSymbols(diff: string): string[] {
  if (!diff.trim()) return []
  const counts = new Map<string, number>()
  for (const line of diff.split('\n')) {
    if (!line.startsWith('+') && !line.startsWith('-')) continue
    if (line.startsWith('+++') || line.startsWith('---')) continue
    const body = line.slice(1)
    for (const pattern of DECLARATION_PATTERNS) {
      pattern.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = pattern.exec(body))) {
        const symbol = match[1]
        counts.set(symbol, (counts.get(symbol) ?? 0) + 1)
      }
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10)
    .map(([symbol]) => symbol)
}
