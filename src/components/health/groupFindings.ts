import type { WorkerFinding } from '../../bindings'

export type WorkerGroup = {
  worker: string
  findings: WorkerFinding[]
}

export function groupFindings(findings: WorkerFinding[]): WorkerGroup[] {
  const groups = new Map<string, WorkerFinding[]>()
  for (const finding of findings) {
    const workerFindings = groups.get(finding.worker) ?? []
    workerFindings.push(finding)
    groups.set(finding.worker, workerFindings)
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([worker, workerFindings]) => ({
      worker,
      findings: [...workerFindings].sort((left, right) => {
        const priority = left.priority - right.priority
        if (priority !== 0) return priority
        const created = right.created_at.localeCompare(left.created_at)
        if (created !== 0) return created
        return left.issue_id.localeCompare(right.issue_id)
      }),
    }))
}
