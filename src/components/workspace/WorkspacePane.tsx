// WorkspacePane — recursive renderer dispatching on PaneNode.kind.
import { useWorkspaceStore } from '../../stores/workspace'
import type { PaneNode } from '../../utils/paneTree'
import { LeafPane } from './LeafPane'
import { SplitContainer } from './SplitContainer'
import { WorkspaceDndProvider } from './WorkspaceDndProvider'

export function WorkspaceRoot() {
  const root = useWorkspaceStore((s: { root: import('../../utils/paneTree').PaneNode }) => s.root)
  return (
    <WorkspaceDndProvider>
      <WorkspacePane node={root} isRoot />
    </WorkspaceDndProvider>
  )
}

interface WorkspacePaneProps {
  node: PaneNode
  isRoot?: boolean
}

export function WorkspacePane({ node, isRoot = false }: WorkspacePaneProps) {
  if (node.kind === 'leaf') {
    return <LeafPane node={node} isRoot={isRoot} />
  }
  return (
    <SplitContainer
      node={node}
      renderChild={(child) => <WorkspacePane node={child} />}
    />
  )
}
