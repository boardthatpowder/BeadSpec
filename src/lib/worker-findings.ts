export type WorkerProvenance = {
  worker: string
  firstLine: string
}

export type WorkerSeverity = 'critical' | 'high' | 'medium' | 'low'

const WORKER_PREFIX = 'Auto-filed by ruflo-'
const WORKER_DELIMITER = ' on '
const SEVERITIES: WorkerSeverity[] = ['critical', 'high', 'medium', 'low']

// Keep this parser coupled to ruflo's on-finding.sh prefix and the Rust
// parse_worker_from_notes helper in src-tauri/src/commands/workers.rs.
export function parseWorkerProvenance(notes: string | null | undefined): WorkerProvenance | null {
  const lineEnd = notes?.indexOf('\n') ?? -1
  const rawFirstLine = lineEnd >= 0 ? notes?.slice(0, lineEnd) : notes
  const firstLine = rawFirstLine?.endsWith('\r') ? rawFirstLine.slice(0, -1) : rawFirstLine
  if (!firstLine) return null
  if (!firstLine.startsWith(WORKER_PREFIX)) return null

  const rest = firstLine.slice(WORKER_PREFIX.length)
  const delimiterIndex = rest.indexOf(WORKER_DELIMITER)
  if (delimiterIndex < 0) return null

  const worker = rest.slice(0, delimiterIndex)
  if (!worker || !isWorkerToken(worker)) return null

  return { worker, firstLine }
}

function isWorkerToken(value: string): boolean {
  for (const char of value) {
    const code = char.charCodeAt(0)
    const isLower = code >= 97 && code <= 122
    const isDigit = code >= 48 && code <= 57
    if (!isLower && !isDigit && char !== '-') return false
  }
  return true
}

export function priorityToSeverity(priority: number): WorkerSeverity {
  if (priority === 1) return 'critical'
  if (priority === 2) return 'high'
  if (priority === 3) return 'medium'
  return 'low'
}

export function formatSeverityBreakdown(priorities: number[]): string {
  const counts = new Map<WorkerSeverity, number>(SEVERITIES.map(severity => [severity, 0]))
  for (const priority of priorities) {
    const severity = priorityToSeverity(priority)
    counts.set(severity, (counts.get(severity) ?? 0) + 1)
  }

  return SEVERITIES
    .map(severity => {
      const count = counts.get(severity) ?? 0
      return count > 0 ? `${count} ${severity}` : null
    })
    .filter((value): value is string => value !== null)
    .join(', ')
}

export function formatWorkerFindingDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}
