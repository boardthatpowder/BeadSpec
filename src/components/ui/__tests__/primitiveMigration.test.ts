import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const repoRoot = new URL('../../../../', import.meta.url)

function source(relativePath: string) {
  return readFileSync(new URL(relativePath, repoRoot), 'utf8')
}

function filesUnder(relativeDir: string): string[] {
  return readdirSync(new URL(`${relativeDir}/`, repoRoot), { withFileTypes: true })
    .flatMap((entry) => {
      const child = `${relativeDir}/${entry.name}`
      if (entry.isDirectory()) return filesUnder(child)
      return child.endsWith('.tsx') ? [child] : []
    })
}

const rawPrimitiveExceptions = new Set([
  'src/components/ui/Button.tsx',
  'src/components/ui/IconButton.tsx',
  'src/components/ui/BdAutocomplete.tsx',
])

const componentContractFiles = [
  ...filesUnder('src/components'),
  'src/QuickCaptureApp.tsx',
].filter((file) =>
  !file.includes('/__tests__/') &&
  !file.endsWith('.test.tsx') &&
  !rawPrimitiveExceptions.has(file)
)

const dialogTargets = [
  'src/components/CommandPalette.tsx',
  'src/components/settings/SettingsDialog.tsx',
  'src/components/shortcuts/ShortcutModal.tsx',
  'src/components/recovery/RecoveryDialog.tsx',
  'src/components/task-detail/TaskPickerModal.tsx',
  'src/components/memory-browser/MemoryBrowser.tsx',
  'src/components/changes-browser/ImportModal.tsx',
  'src/components/bd-formulas/PourConfirmDialog.tsx',
  'src/components/task-detail/StatusDropdown.tsx',
  'src/components/health/SessionsTab.tsx',
]

const tabTargets = [
  'src/components/task-detail/TaskDetailPanel.tsx',
  'src/components/health/BdHealthPanel.tsx',
  'src/components/layout/index.tsx',
]

const popoverTargets = [
  'src/components/filters/FilterBar.tsx',
  'src/components/changes-browser/ChangesBrowser.tsx',
  'src/components/process-browser/ProcessBrowser.tsx',
  'src/components/workspace/TabContextMenu.tsx',
]

describe('primitive migration contract', () => {
  it('uses Dialog for every enumerated modal surface', () => {
    for (const file of dialogTargets) {
      const contents = source(file)

      expect(contents, file).toContain('Dialog.Root')
      expect(contents, file).not.toMatch(/fixed\s+inset-0[\s\S]{0,160}bg-black/)
    }
  })

  it('uses Button instead of raw button elements in component files', () => {
    for (const file of componentContractFiles) {
      const contents = source(file)

      expect(contents, file).not.toMatch(/<button\b/)
    }
  })

  it('uses Icon instead of inline svg blocks or functional glyphs', () => {
    for (const file of componentContractFiles) {
      const contents = source(file)

      expect(contents, file).not.toMatch(/<svg\b/)
      expect(contents, file).not.toMatch(/[↗✓✗⚠↑↓↕🔗✕]/u)
    }
  })

  it('uses Tabs for every migrated tab bar', () => {
    for (const file of tabTargets) {
      const contents = source(file)

      expect(contents, file).toContain('Tabs.Root')
      expect(contents, file).not.toMatch(/<button[\s\S]{0,400}border-b-2/)
    }
  })

  it('uses Popover for every migrated dropdown surface', () => {
    for (const file of popoverTargets) {
      const contents = source(file)

      expect(contents, file).toContain('Popover.Root')
      expect(contents, file).not.toMatch(/createPortal|getBoundingClientRect|document\.addEventListener/)
    }
  })
})
