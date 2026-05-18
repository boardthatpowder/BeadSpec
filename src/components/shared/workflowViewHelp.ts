export const WORKFLOW_VIEW_HELP = {
  activity: {
    title: 'Activity Feed',
    description: 'Project-wide timeline for Beads, Ruflo, GitNexus, and OpenSpec events. Use a task Activity tab when you need issue-specific history.',
  },
  processes: {
    title: 'Processes Browser',
    description: 'GitNexus execution-flow explorer for indexed call traces. Search flows, inspect step-by-step symbols, and find issues touching a process.',
  },
  memory: {
    title: 'Memory Browser',
    description: 'Ruflo AgentDB memory explorer for saved session, trajectory, retrospective, and follow-up context, grouped by namespace keys.',
  },
} as const

export type WorkflowViewHelp = typeof WORKFLOW_VIEW_HELP[keyof typeof WORKFLOW_VIEW_HELP]
