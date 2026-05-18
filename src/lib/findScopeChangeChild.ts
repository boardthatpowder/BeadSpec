import type { Task, TaskDetail } from '../bindings'

type TaskLike = Pick<Task, 'id' | 'title' | 'labels' | 'created_at'> & {
  description?: string | null
}

type CurrentTaskLike = Pick<TaskDetail, 'id' | 'labels'> & {
  description?: string | null
}

function openspecLabels(task: { labels: string[] }) {
  return task.labels.filter(label => label.startsWith('openspec:'))
}

function resolvesId(notes: string | null | undefined) {
  if (!notes) return null
  for (const line of notes.split('\n')) {
    const match = /^Resolves:\s*([A-Za-z0-9-]+)/.exec(line.trim())
    if (match) return match[1]
  }
  return null
}

export function findScopeChangeChild(
  currentTask: CurrentTaskLike,
  allTasks: TaskLike[],
  blockingIds: string[],
): TaskLike | null {
  const explicitId = resolvesId(currentTask.description)
  if (explicitId) {
    const explicit = allTasks.find(task => task.id === explicitId)
    if (explicit) return explicit
  }

  const sharedOpenSpec = new Set(openspecLabels(currentTask))
  const blocking = new Set(blockingIds)
  const candidates = allTasks
    .filter(task => task.id !== currentTask.id)
    .filter(task => blocking.has(task.id))
    .filter(task => openspecLabels(task).some(label => sharedOpenSpec.has(label)))
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))

  return candidates[0] ?? null
}
