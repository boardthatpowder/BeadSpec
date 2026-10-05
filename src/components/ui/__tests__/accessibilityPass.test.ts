import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function read(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), 'utf8')
}

describe('accessibility pass contract', () => {
  it('uses the accent focus-visible ring on focusable primitives', () => {
    const indexCss = read('src/index.css')
    const button = read('src/components/ui/Button.tsx')
    const iconButton = read('src/components/ui/IconButton.tsx')
    const tabs = read('src/components/ui/Tabs.tsx')

    expect(indexCss).toContain('*:focus-visible')
    expect(indexCss).toContain('outline: 2px solid var(--color-accent)')
    expect(indexCss).toContain('outline-offset: 2px')
    for (const source of [button, iconButton, tabs]) {
      expect(source).toContain('focus-visible:ring-2')
      expect(source).toContain('focus-visible:ring-(--color-accent)')
      expect(source).toContain('focus-visible:ring-offset-1')
      expect(source).toContain('focus-visible:ring-offset-(--color-bg)')
    }
  })

  it('provides names for icon-only controls and labels for form fields', () => {
    const taskList = read('src/components/task-list/TaskList.tsx')
    const changesBrowser = read('src/components/changes-browser/ChangesBrowser.tsx')
    const processBrowser = read('src/components/process-browser/ProcessBrowser.tsx')
    const memoryBrowser = read('src/components/memory-browser/MemoryBrowser.tsx')
    const reviewsHealthTab = read('src/components/health/ReviewsHealthTab.tsx')

    expect(taskList).toContain('return `Sort ${labels[field]} ${direction}`')
    for (const label of ['Title', 'Status', 'Priority']) {
      expect(taskList).toContain(`'${label}'`)
    }
    expect(taskList).toContain("aria-label={sortLabel('title')}")
    expect(taskList).toContain("aria-label={sortLabel('status')}")
    expect(taskList).toContain("aria-label={sortLabel('priority')}")
    expect(changesBrowser).toContain("aria-label={collapsed ? 'Show archived' : 'Hide archived'}")
    expect(processBrowser).toContain('aria-label="Filter by cluster"')
    expect(processBrowser).toContain('htmlFor="process-search"')
    expect(processBrowser).toContain('htmlFor="process-cluster"')
    expect(memoryBrowser).toContain('htmlFor="memory-key"')
    expect(memoryBrowser).toContain('htmlFor="memory-value"')
    expect(reviewsHealthTab).toContain('htmlFor="reviews-search"')
  })

  it('adds redundant non-color cues to state indicators', () => {
    const statusDropdown = read('src/components/task-detail/StatusDropdown.tsx')
    const openSpecPanel = read('src/components/task-detail/OpenSpecPanel.tsx')
    const impactPanel = read('src/components/task-detail/ImpactPanel.tsx')
    const bdHumanQueue = read('src/components/notifications/BdHumanQueue.tsx')

    expect(statusDropdown).toContain('STATUS_ICONS')
    expect(statusDropdown).toContain("name={STATUS_ICONS[s]}")
    expect(openSpecPanel).toContain('aria-label={result.valid ? \'passed\' : \'failed\'}')
    expect(impactPanel).toContain('aria-label={`risk: ${report.risk}`}')
    expect(bdHumanQueue).toContain('aria-live="polite"')
    expect(bdHumanQueue).toContain('aria-label={`${items.length} issues awaiting human review`}')
  })

  it('configures jsx-a11y rules at warning level', () => {
    const eslintConfig = read('eslint.config.js')
    const packageJson = read('package.json')

    expect(packageJson).toContain('"eslint-plugin-jsx-a11y"')
    expect(eslintConfig).toContain('jsxA11yPlugin')
    expect(eslintConfig).toContain('jsx-a11y')
    expect(eslintConfig).toContain('Array.isArray(severity) ? ["warn", ...severity.slice(1)] : "warn"')
  })
})
