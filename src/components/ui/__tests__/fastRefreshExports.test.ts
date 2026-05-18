import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function read(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), 'utf8')
}

describe('Fast Refresh component boundaries', () => {
  it.each([
    ['src/components/memory-browser/MemoryBrowser.tsx', 'buildNamespaceTree'],
    ['src/components/health/WorkerFindingsPanel.tsx', 'groupFindings'],
    ['src/components/ui/Toast.tsx', 'useToast'],
    ['src/components/ui/Toast.tsx', 'useToastStore'],
    ['src/components/ui/Tooltip.tsx', 'TooltipConfigContext'],
  ])('%s does not export %s from a component module', (relativePath, exportName) => {
    const source = read(relativePath)

    expect(source).not.toMatch(new RegExp(`export\\s+(?:const|function)\\s+${exportName}\\b`))
  })
})
