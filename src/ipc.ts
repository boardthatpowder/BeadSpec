// Bridges tauri-specta's typed Result returns to throwing Promises.
// Import 'commands' from here instead of using raw invoke().
export { commands } from './bindings'
import { commands } from './bindings'
import type {
  ActivityEvent,
  ChangeBeadsProgress,
  ChangeDependencies,
  ChangeInfo,
  ChangeProgress,
  CommandOutput,
  EpicReadySnapshot,
  GitnexusStatus,
  GitnexusAnalyzeHandle,
  IndexStatus,
  IssueMatch,
  MemoryListResponse,
  ProcessDetail,
  ProcessSummary,
  Cluster,
  ReanalyzeHandle,
  ReviewEntry,
  ReviewScope,
  SessionSnapshot,
  Task,
  ValidationHistoryEntry,
  ValidationResult,
} from './bindings'

export async function unwrap<T>(
  result: Promise<{ status: 'ok'; data: T } | { status: 'error'; error: string }>
): Promise<T> {
  const r = await result
  if (r.status === 'error') throw r.error
  return r.data
}

// Typed OpenSpec IPC helpers
export function listChanges(projectPath: string): Promise<ChangeInfo[]> {
  return unwrap(commands.listChanges(projectPath))
}

export function readChangeArtifact(projectPath: string, change: string, artifact: string): Promise<string> {
  return unwrap(commands.readChangeArtifact(projectPath, change, artifact))
}

export function getChangeProgress(projectPath: string, change: string): Promise<ChangeProgress> {
  return unwrap(commands.getChangeProgress(projectPath, change))
}

export function getChangeBeadsProgress(projectPath: string, changeSlug: string): Promise<ChangeBeadsProgress> {
  return unwrap(commands.getChangeBeadsProgress(projectPath, changeSlug))
}

export function getChangeDependencies(projectPath: string, changeSlug: string): Promise<ChangeDependencies> {
  return unwrap(commands.getChangeDependencies(projectPath, changeSlug))
}

export function runOpenspecValidate(projectPath: string, change: string): Promise<ValidationResult> {
  return unwrap(commands.runOpenspecValidate(projectPath, change))
}

export function importChangeToBeads(projectPath: string, change: string): Promise<CommandOutput> {
  return unwrap(commands.importChangeToBeads(projectPath, change))
}

export function listGitnexusProcesses(projectPath: string): Promise<ProcessSummary[]> {
  return unwrap(commands.listGitnexusProcesses(projectPath))
}

export function getGitnexusProcess(projectPath: string, name: string): Promise<ProcessDetail> {
  return unwrap(commands.getGitnexusProcess(projectPath, name))
}

export function listGitnexusClusters(projectPath: string): Promise<Cluster[]> {
  return unwrap(commands.listGitnexusClusters(projectPath))
}

export function findIssuesTouchingProcess(projectPath: string, processName: string): Promise<IssueMatch[]> {
  return unwrap(commands.findIssuesTouchingProcess(projectPath, processName))
}

export function getGitnexusIndexStatus(projectPath: string): Promise<IndexStatus> {
  return unwrap(commands.getGitnexusIndexStatus(projectPath))
}

export function triggerGitnexusReanalyze(projectPath: string): Promise<ReanalyzeHandle> {
  return unwrap(commands.triggerGitnexusReanalyze(projectPath))
}

export function getGitnexusStatus(projectPath: string): Promise<GitnexusStatus> {
  return unwrap(commands.getGitnexusStatus(projectPath))
}

export function runGitnexusAnalyze(projectPath: string): Promise<GitnexusAnalyzeHandle> {
  return unwrap(commands.runGitnexusAnalyze(projectPath))
}

export function rufloMemoryList(prefix?: string, limit?: number): Promise<MemoryListResponse> {
  return unwrap(commands.rufloMemoryList(prefix ?? null, limit ?? null))
}

export function rufloMemoryStore(key: string, value: string): Promise<void> {
  return unwrap(commands.rufloMemoryStore(key, value)).then(() => undefined)
}

export function rufloMemoryDelete(key: string): Promise<void> {
  return unwrap(commands.rufloMemoryDelete(key)).then(() => undefined)
}

export function listSessionSnapshots(projectPath: string): Promise<SessionSnapshot[]> {
  return unwrap(commands.listSessionSnapshots(projectPath))
}

export function recordOpenspecValidation(projectPath: string, changeSlug: string, resultJson: string): Promise<void> {
  return unwrap(commands.recordOpenspecValidation(projectPath, changeSlug, resultJson)).then(() => undefined)
}

export function listOpenspecValidations(projectPath: string, changeSlug: string): Promise<ValidationHistoryEntry[]> {
  return unwrap(commands.listOpenspecValidations(projectPath, changeSlug))
}

export function listRecentEvents(projectPath: string, limit: number, sinceTs?: string): Promise<ActivityEvent[]> {
  return unwrap(commands.listRecentEvents(projectPath, limit, sinceTs ?? null))
}

export function listReviews(projectPath: string, scope: ReviewScope): Promise<ReviewEntry[]> {
  return unwrap(commands.listReviews(projectPath, scope))
}

export function getReview(key: string): Promise<ReviewEntry> {
  return unwrap(commands.getReview(key))
}

export function getEpicReadySnapshot(projectPath: string, epicId: string): Promise<EpicReadySnapshot> {
  return unwrap(commands.getEpicReadySnapshot(projectPath, epicId))
}

export function claimTask(projectPath: string, taskId: string): Promise<Task> {
  return unwrap(commands.claimTask(projectPath, taskId))
}
