import type { ActivityEvent } from '../../bindings'

export function activityChannel(project: string) {
  const identity = Array.from(new TextEncoder().encode(project), byte => byte.toString(16).padStart(2, '0')).join('')
  return `workflow:activity:${identity}`
}

export function appendActivityEvent(previous: ActivityEvent[] | undefined, event: ActivityEvent) {
  return [event, ...(previous ?? []).filter(item => item.id !== event.id)].slice(0, 500)
}
