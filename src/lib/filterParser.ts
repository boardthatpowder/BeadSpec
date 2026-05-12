import type { Task } from '../bindings'

// ─── Grouping Types ───────────────────────────────────────────────────────────

/** Discriminated union representing all valid grouping configurations. null = flat list. */
export type GroupConfig =
  | { type: 'field'; field: 'status' | 'priority' | 'assignee' | 'task_type' }
  | { type: 'label-prefix'; prefix: string }
  | null

/** A single section of grouped tasks. */
export interface GroupedSection {
  key: string    // unique stable key for React and collapse state
  label: string  // display name for section header
  tasks: Task[]
}

const STATUS_ORDER = ['open', 'in_progress', 'blocked', 'closed'] as const
const PRIORITY_LABELS: Record<number, string> = {
  1: 'P1 Critical',
  2: 'P2 High',
  3: 'P3 Medium',
  4: 'P4 Low',
}

/**
 * Group a task array into ordered GroupedSection[].
 * - null config: single unlabeled '__all__' section (flat mode)
 * - field: partition by task field value; include empty sections
 * - label-prefix: group by suffix after prefix:, multi-section for multi-match tasks
 */
export function groupTasks(tasks: Task[], config: GroupConfig): GroupedSection[] {
  if (config === null) {
    return [{ key: '__all__', label: '', tasks }]
  }

  if (config.type === 'field') {
    const { field } = config

    if (field === 'status') {
      return STATUS_ORDER.map(status => ({
        key: status,
        label: status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()),
        tasks: tasks.filter(t => t.status === status),
      }))
    }

    if (field === 'priority') {
      const priorities = [1, 2, 3, 4]
      return priorities.map(p => ({
        key: String(p),
        label: PRIORITY_LABELS[p] ?? `P${p}`,
        tasks: tasks.filter(t => t.priority === p),
      }))
    }

    if (field === 'assignee') {
      const assignees = new Set<string>()
      for (const t of tasks) {
        const v = (t as unknown as Record<string, unknown>).assignee
        assignees.add(typeof v === 'string' && v ? v : '(unassigned)')
      }
      const sorted = [...assignees].sort((a, b) => {
        if (a === '(unassigned)') return 1
        if (b === '(unassigned)') return -1
        return a.localeCompare(b)
      })
      return sorted.map(assignee => ({
        key: assignee,
        label: assignee,
        tasks: tasks.filter(t => {
          const v = (t as unknown as Record<string, unknown>).assignee
          const val = typeof v === 'string' && v ? v : '(unassigned)'
          return val === assignee
        }),
      }))
    }

    if (field === 'task_type') {
      const types = new Set<string>()
      for (const t of tasks) {
        const v = (t as unknown as Record<string, unknown>).task_type
        types.add(typeof v === 'string' && v ? v : '(no type)')
      }
      const sorted = [...types].sort((a, b) => {
        if (a === '(no type)') return 1
        if (b === '(no type)') return -1
        return a.localeCompare(b)
      })
      return sorted.map(taskType => ({
        key: taskType,
        label: taskType,
        tasks: tasks.filter(t => {
          const v = (t as unknown as Record<string, unknown>).task_type
          const val = typeof v === 'string' && v ? v : '(no type)'
          return val === taskType
        }),
      }))
    }

    return [{ key: '__all__', label: '', tasks }]
  }

  if (config.type === 'label-prefix') {
    const { prefix } = config
    const prefixColon = prefix + ':'
    const sectionMap = new Map<string, Task[]>()
    const noneSection: Task[] = []

    for (const task of tasks) {
      const matchingSuffixes = task.labels
        .filter(l => l.startsWith(prefixColon))
        .map(l => l.slice(prefixColon.length))

      if (matchingSuffixes.length === 0) {
        noneSection.push(task)
      } else {
        for (const suffix of matchingSuffixes) {
          if (!sectionMap.has(suffix)) sectionMap.set(suffix, [])
          sectionMap.get(suffix)!.push(task)
        }
      }
    }

    const sections: GroupedSection[] = [...sectionMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([suffix, sectionTasks]) => ({
        key: suffix,
        label: suffix,
        tasks: sectionTasks,
      }))

    if (noneSection.length > 0) {
      sections.push({ key: '(none)', label: '(none)', tasks: noneSection })
    }

    return sections
  }

  return [{ key: '__all__', label: '', tasks }]
}

/** Serialize a GroupConfig to a string for URL hash / Tauri store. null → null */
export function serializeGroupConfig(config: GroupConfig): string | null {
  if (config === null) return null
  if (config.type === 'field') return `field:${config.field}`
  if (config.type === 'label-prefix') return `label:${config.prefix}`
  return null
}

/** Deserialize a string back to GroupConfig. Unknown values gracefully degrade to null. */
export function deserializeGroupConfig(s: string | null | undefined): GroupConfig {
  if (!s) return null
  if (s.startsWith('field:')) {
    const field = s.slice('field:'.length)
    if (field === 'status' || field === 'priority' || field === 'assignee' || field === 'task_type') {
      return { type: 'field', field }
    }
    return null
  }
  if (s.startsWith('label:')) {
    const prefix = s.slice('label:'.length)
    if (prefix) return { type: 'label-prefix', prefix }
    return null
  }
  return null
}

// ─── Filter Types ─────────────────────────────────────────────────────────────

export interface FilterDimension {
  key: string           // e.g. "branch", "status", "priority", "tags"
  values: string[]      // sorted unique values
  isStructured: boolean // true = parsed from prefix:value, false = flat label
}

export interface ParsedFilters {
  dimensions: FilterDimension[]
}

export interface DimensionGroup {
  name: string
  dimensions: FilterDimension[]
}

/**
 * Scan all task labels and auto-detect prefix:value structure.
 * Split on FIRST colon only: "url:https://x.com" → prefix="url", value="https://x.com"
 * Unstructured labels (no colon) → "tags" dimension.
 */
export function parseFilterDimensions(allLabels: string[]): ParsedFilters {
  const structured = new Map<string, Set<string>>()
  const tags = new Set<string>()

  for (const label of allLabels) {
    const colonIdx = label.indexOf(':')
    if (colonIdx > 0) {
      const prefix = label.slice(0, colonIdx)
      const value = label.slice(colonIdx + 1)
      if (!structured.has(prefix)) structured.set(prefix, new Set())
      structured.get(prefix)!.add(value)
    } else {
      tags.add(label)
    }
  }

  const dimensions: FilterDimension[] = []

  for (const [key, vals] of [...structured.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    dimensions.push({
      key,
      values: [...vals].sort(),
      isStructured: true,
    })
  }

  if (tags.size > 0) {
    dimensions.push({
      key: 'tags',
      values: [...tags].sort(),
      isStructured: false,
    })
  }

  return { dimensions }
}

// Semantic clusters for auto-grouping — keyword partial-match, case-insensitive.
// First match wins; clusters with only 1 dimension are folded into ungrouped.
const SEMANTIC_CLUSTERS: Array<{ name: string; keywords: string[] }> = [
  { name: 'Git',      keywords: ['branch', 'repo', 'worktree', 'remote', 'commit', 'tag'] },
  { name: 'Workflow', keywords: ['openspec', 'area', 'audit', 'sprint', 'milestone', 'phase'] },
  { name: 'People',   keywords: ['worker', 'assignee', 'team', 'owner', 'ruflo'] },
  { name: 'Triage',   keywords: ['duplicate', 'followup', 'wontfix', 'invalid'] },
]

export function detectDimensionGroups(dimensions: FilterDimension[]): DimensionGroup[] {
  const clusterBuckets = new Map<string, FilterDimension[]>()
  const ungrouped: FilterDimension[] = []

  for (const dim of dimensions) {
    const key = dim.key.toLowerCase()
    let matched = false
    for (const cluster of SEMANTIC_CLUSTERS) {
      if (cluster.keywords.some(kw => key.includes(kw))) {
        if (!clusterBuckets.has(cluster.name)) clusterBuckets.set(cluster.name, [])
        clusterBuckets.get(cluster.name)!.push(dim)
        matched = true
        break
      }
    }
    if (!matched) ungrouped.push(dim)
  }

  const groups: DimensionGroup[] = []

  // Clusters with 2+ dimensions get their own group; singletons go to ungrouped
  for (const [name, dims] of clusterBuckets.entries()) {
    if (dims.length >= 2) {
      groups.push({ name, dimensions: dims })
    } else {
      ungrouped.push(...dims)
    }
  }

  // Sort groups by order they appear in SEMANTIC_CLUSTERS
  groups.sort((a, b) => {
    const ai = SEMANTIC_CLUSTERS.findIndex(c => c.name === a.name)
    const bi = SEMANTIC_CLUSTERS.findIndex(c => c.name === b.name)
    return ai - bi
  })

  if (ungrouped.length > 0) {
    groups.push({ name: '', dimensions: ungrouped.sort((a, b) => a.key.localeCompare(b.key)) })
  }

  return groups
}

/**
 * Compute how many tasks have each value for a given dimension,
 * based on the provided task set (use filteredTasks for contextual counts).
 */
export function computeDimensionCounts(
  tasks: Array<{ status: string; priority: number; labels: string[] }>,
  dimensionKey: string,
): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const task of tasks) {
    if (dimensionKey === 'status') {
      counts[task.status] = (counts[task.status] ?? 0) + 1
    } else if (dimensionKey === 'priority') {
      const k = String(task.priority)
      counts[k] = (counts[k] ?? 0) + 1
    } else if (dimensionKey === 'tags') {
      for (const label of task.labels) {
        if (!label.includes(':')) counts[label] = (counts[label] ?? 0) + 1
      }
    } else {
      const prefix = dimensionKey + ':'
      for (const label of task.labels) {
        if (label.startsWith(prefix)) {
          const val = label.slice(prefix.length)
          counts[val] = (counts[val] ?? 0) + 1
        }
      }
    }
  }
  return counts
}

/** Workspace scope filter parameters. When enabled, all labels must be present on the task. */
export interface WorkspaceFilter {
  labels: string[]
  enabled: boolean
}

/**
 * Apply active filters to a task list. AND across dimensions, OR within.
 * If workspaceFilter is provided and enabled, an AND-filter requiring all
 * workspaceFilter.labels to be present is applied as a pre-pass before user filters.
 */
export function applyFilters<T extends { id: string; title: string; status: string; priority: number; labels: string[] }>(
  tasks: T[],
  activeFilters: Record<string, string[] | string | undefined>,
  workspaceFilter?: WorkspaceFilter,
): T[] {
  // Pre-pass: workspace AND-filter (all labels must match)
  let filtered = tasks
  if (workspaceFilter && workspaceFilter.enabled && workspaceFilter.labels.length > 0) {
    filtered = tasks.filter(task =>
      workspaceFilter.labels.every(label => task.labels.includes(label))
    )
  }

  return filtered.filter(task => {
    for (const [dimension, selectedValues] of Object.entries(activeFilters)) {
      if (!selectedValues) continue

      if (dimension === 'search') {
        const q = (selectedValues as string).toLowerCase()
        if (!q) continue
        if (!task.title.toLowerCase().includes(q) && !task.id.toLowerCase().includes(q)) return false
        continue
      }

      const vals = selectedValues as string[]
      if (!vals.length) continue

      if (dimension === 'status') {
        if (!vals.includes(task.status)) return false
        continue
      }
      if (dimension === 'priority') {
        if (!vals.includes(String(task.priority))) return false
        continue
      }

      const taskPrefixValues = task.labels
        .filter(l => l.startsWith(dimension + ':'))
        .map(l => l.slice(dimension.length + 1))

      const taskValues = dimension === 'tags'
        ? task.labels.filter(l => !l.includes(':'))
        : taskPrefixValues

      if (!vals.some(v => taskValues.includes(v))) return false
    }
    return true
  })
}

/**
 * Count dimension values for tasks after applying all active filters except the given dimension.
 * Standard faceted-search pattern: excludes dim's own filter so all its values stay selectable
 * (OR-within), while every other active filter still narrows the counts.
 */
export function countsExcludingDim(
  tasks: Array<{ id: string; title: string; status: string; priority: number; labels: string[] }>,
  activeFilters: Record<string, string[] | string | undefined>,
  dim: string,
): Record<string, number> {
  const { [dim]: _omit, ...rest } = activeFilters
  return computeDimensionCounts(applyFilters(tasks, rest), dim)
}
