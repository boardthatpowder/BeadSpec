import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const repoRoot = new URL('../../../../', import.meta.url)

function source(relativePath: string) {
  return readFileSync(new URL(relativePath, repoRoot), 'utf8')
}

const dashboardTargets = [
  'src/components/activity-feed/ActivityFeed.tsx',
  'src/components/memory-browser/MemoryBrowser.tsx',
  'src/components/process-browser/ProcessBrowser.tsx',
  'src/components/health/SessionsTab.tsx',
  'src/components/epic-dashboard/EpicDashboard.tsx',
  'src/components/health/WorkerFindingsPanel.tsx',
]

const timestampTargets = [
  'src/components/activity-feed/ActivityRow.tsx',
  'src/components/memory-browser/MemoryBrowser.tsx',
  'src/components/health/SessionsTab.tsx',
  'src/components/task-detail/CommentsSection.tsx',
  'src/components/changes-browser/ChangeCard.tsx',
  'src/components/task-detail/MemoryTrajectoryTab.tsx',
  'src/components/task-detail/TaskDetailPanel.tsx',
  'src/components/reviews/ReviewRow.tsx',
]

describe('dashboard cohesion contract', () => {
  it('defines a shared PanelHeader with the standard slot API and separator', () => {
    const panelHeader = new URL('src/components/shared/PanelHeader.tsx', repoRoot)

    expect(existsSync(panelHeader), 'PanelHeader component file').toBe(true)

    const contents = source('src/components/shared/PanelHeader.tsx')
    expect(contents).toContain('title')
    expect(contents).toContain('description')
    expect(contents).toContain('filters')
    expect(contents).toContain('actions')
    expect(contents).toContain('border-b border-(--color-border)')
    expect(contents).toContain('px-5 py-4')
  })

  it('mounts PanelHeader on every standalone dashboard view', () => {
    for (const file of dashboardTargets) {
      const contents = source(file)

      expect(contents, file).toContain('PanelHeader')
      expect(contents, file).toContain('<PanelHeader')
    }
  })

  it('uses designed loading, empty, and error surfaces on dashboards', () => {
    for (const file of dashboardTargets) {
      const contents = source(file)

      expect(contents, file).not.toContain('Loading…')
      expect(contents, file).not.toMatch(/\bString\([^)]*error[^)]*\)/i)
      expect(contents, file).toContain('EmptyState')
      expect(contents, file).toContain('ErrorState')
    }
  })

  it('replaces raw native title attributes in the scoped icon/tooltip pass', () => {
    for (const file of [
      'src/components/activity-feed/ActivityRow.tsx',
      'src/components/health/WorkerFindingsPanel.tsx',
      'src/components/task-list/TaskList.tsx',
    ]) {
      const contents = source(file)

      expect(contents, file).not.toMatch(/<button\b/)
      expect(contents, file).not.toMatch(/<Button(?=[^>]*\stitle=)[^>]*>/)
      expect(contents, file).not.toMatch(/<span(?=[^>]*\stitle=)[^>]*>/)
    }
  })

  it('routes scoped timestamps through shared date helpers', () => {
    for (const file of timestampTargets) {
      const contents = source(file)

      expect(contents, file).not.toMatch(/toLocale(?:String|DateString|TimeString)\(/)
      expect(contents, file).toMatch(/format(?:Absolute|Relative)/)
    }

    expect(source('src/lib/worker-findings.ts')).not.toContain('formatWorkerFindingDate')
    expect(source('src/components/health/WorkerFindingsPanel.tsx')).toContain('formatAbsolute')
  })

  it('routes scoped status, outcome, and risk classes through shared palettes', () => {
    for (const file of [
      'src/components/task-list/TaskListItem.tsx',
      'src/components/task-list/TaskList.tsx',
      'src/components/task-detail/StatusDropdown.tsx',
      'src/components/changes-browser/ChangeCard.tsx',
      'src/components/task-detail/MemoryTrajectoryTab.tsx',
      'src/components/task-detail/ImpactPanel.tsx',
      'src/components/epic-dashboard/EpicDashboard.tsx',
    ]) {
      const contents = source(file)

      expect(contents, file).not.toMatch(/STATUS_BADGE|STATUS_COLORS|STATUS_CONFIG|RISK_CLASS/)
    }
  })
})
