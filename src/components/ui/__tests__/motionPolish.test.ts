import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function read(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), 'utf8')
}

describe('motion polish contract', () => {
  it('imports the Tailwind v4 animation utilities', () => {
    const indexCss = read('src/index.css')
    const packageJson = JSON.parse(read('package.json'))

    expect(packageJson.devDependencies).toHaveProperty('tw-animate-css')
    expect(indexCss).toContain('@import "tw-animate-css";')
  })

  it('adds reduced-motion-aware Radix enter and exit animations', () => {
    const dialog = read('src/components/ui/Dialog.tsx')
    const popover = read('src/components/ui/Popover.tsx')
    const tooltip = read('src/components/ui/Tooltip.tsx')

    for (const source of [dialog, popover, tooltip]) {
      expect(source).toContain('forceMount')
      expect(source).toContain('data-[state=open]:animate-in')
      expect(source).toContain('data-[state=closed]:animate-out')
      expect(source).toContain('motion-reduce:animate-none')
      expect(source).toContain('motion-reduce:transition-none')
    }

    expect(dialog).toContain('data-[state=open]:zoom-in-95')
    expect(dialog).toContain('data-[state=closed]:zoom-out-95')
    expect(popover).toContain('data-[state=open]:slide-in-from-top-2')
    expect(popover).toContain('data-[state=closed]:slide-out-to-top-2')
    expect(tooltip).toContain('duration-100')
  })

  it('animates command palette and toast entrance and exit', () => {
    const commandPalette = read('src/components/CommandPalette.tsx')
    const toast = read('src/components/ui/Toast.tsx')

    expect(commandPalette).toContain('data-[state=open]:animate-in')
    expect(commandPalette).toContain('data-[state=open]:zoom-in-95')
    expect(commandPalette).toContain('data-[state=closed]:zoom-out-95')
    expect(commandPalette).toContain('motion-reduce:animate-none')

    expect(toast).toContain('dismissing?: boolean')
    expect(toast).toContain('TOAST_EXIT_MS = 150')
    expect(toast).toContain('animate-in slide-in-from-bottom-2 fade-in-0 duration-200')
    expect(toast).toContain('animate-out slide-out-to-bottom-2 fade-out-0 duration-150')
  })

  it('uses optimistic task and memory mutations with rollback', () => {
    const taskDetail = read('src/components/task-detail/TaskDetailPanel.tsx')
    const memoryBrowser = read('src/components/memory-browser/MemoryBrowser.tsx')
    const statusDropdown = read('src/components/task-detail/StatusDropdown.tsx')

    for (const source of [taskDetail, memoryBrowser]) {
      expect(source).toContain('onMutate')
      expect(source).toContain('cancelQueries')
      expect(source).toContain('setQueryData')
      expect(source).toContain('onError')
      expect(source).toContain('onSettled')
      expect(source).toContain('invalidateQueries')
    }

    expect(taskDetail).toContain('claimTask(project, task.id)')
    expect(taskDetail).toContain("changeTaskStatus(project, task.id, 'closed', false)")
    expect(taskDetail).toContain("status: 'in_progress'")
    expect(taskDetail).toContain("status: 'closed'")
    expect(memoryBrowser).toContain('entries.filter((item) => item.key !== entry.key)')
    expect(statusDropdown).toContain('invalidateQueries')
  })
})
