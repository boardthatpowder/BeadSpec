// Bridges tauri-specta's typed Result returns to throwing Promises.
// Import 'commands' from here instead of using raw invoke().
export { commands } from './bindings'
import { commands } from './bindings'
import type { ChangeBeadsProgress, ChangeDependencies, ChangeInfo, ChangeProgress, CommandOutput, ValidationResult, WorkerFinding } from './bindings'

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

export function listWorkerFindings(projectPath: string): Promise<WorkerFinding[]> {
  return unwrap(commands.listWorkerFindings(projectPath))
}
