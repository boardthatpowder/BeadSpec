import type { ChangeInfo } from '../../bindings'

export interface OpenSpecDocReference {
  label: string
  artifact: string
  present: boolean
  current: boolean
}

const FIXED_DOCS = [
  { label: 'proposal.md', artifact: 'proposal.md', present: (change: ChangeInfo) => change.has_proposal },
  { label: 'design.md', artifact: 'design.md', present: (change: ChangeInfo) => change.has_design },
  { label: 'tasks.md', artifact: 'tasks.md', present: (change: ChangeInfo) => change.has_tasks },
] as const

export function buildOpenSpecDocReferences(
  change: ChangeInfo | undefined,
  currentArtifact: string,
): OpenSpecDocReference[] {
  if (!change) {
    return [{
      label: currentArtifact,
      artifact: currentArtifact,
      present: true,
      current: true,
    }]
  }

  return [
    ...FIXED_DOCS.map(({ label, artifact, present }) => ({
      label,
      artifact,
      present: present(change),
      current: artifact === currentArtifact,
    })),
    ...change.specs.map((specId) => {
      const artifact = `specs/${specId}/spec.md`
      return {
        label: `spec: ${specId}`,
        artifact,
        present: true,
        current: artifact === currentArtifact,
      }
    }),
  ]
}
