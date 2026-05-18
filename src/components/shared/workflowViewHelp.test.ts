import { describe, expect, it } from 'vitest'
import { WORKFLOW_VIEW_HELP } from './workflowViewHelp'

describe('WORKFLOW_VIEW_HELP', () => {
  it('documents the three workflow dashboard views', () => {
    expect(Object.keys(WORKFLOW_VIEW_HELP).sort()).toEqual(['activity', 'memory', 'processes'])
    expect(WORKFLOW_VIEW_HELP.activity.description).toContain('Project-wide')
    expect(WORKFLOW_VIEW_HELP.processes.description).toContain('GitNexus')
    expect(WORKFLOW_VIEW_HELP.memory.description).toContain('Ruflo')
  })
})
