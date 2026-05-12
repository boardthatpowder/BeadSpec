export interface Formula {
  name: string
  description: string
}

/**
 * Parse the JSON array output of `bd formula list --json`.
 * Returns an empty array on parse error and sets parseError to true.
 */
export function parseFormulaList(output: string): { formulas: Formula[]; parseError: boolean } {
  try {
    const trimmed = output.trim()
    if (!trimmed) return { formulas: [], parseError: false }
    const parsed = JSON.parse(trimmed)
    if (parsed === null) return { formulas: [], parseError: false }
    if (!Array.isArray(parsed)) return { formulas: [], parseError: true }
    const formulas: Formula[] = parsed
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      .map(item => ({
        name: typeof item['name'] === 'string' ? item['name'] : String(item['name'] ?? ''),
        description: typeof item['description'] === 'string' ? item['description'] : '',
      }))
      .filter(f => f.name.length > 0)
    return { formulas, parseError: false }
  } catch {
    return { formulas: [], parseError: true }
  }
}
