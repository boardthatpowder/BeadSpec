// SplitContainer — react-resizable-panels v4 (Group/Panel/Separator API).
import { Group, Panel, Separator } from 'react-resizable-panels'
import type { Layout } from 'react-resizable-panels'
import { useWorkspaceStore } from '../../stores/workspace'
import type { PaneNode, SplitPane } from '../../utils/paneTree'

interface SplitContainerProps {
  node: SplitPane
  renderChild: (child: PaneNode) => React.ReactNode
}

export function SplitContainer({ node, renderChild }: SplitContainerProps) {
  const { updateSplitSizes } = useWorkspaceStore()

  function handleLayoutChanged(layout: Layout) {
    // v4: layout is { [panelId]: sizePercent }. Convert to ordered array.
    const sizes = node.children.map((child) => layout[child.id] ?? 50)
    updateSplitSizes(node.id, sizes)
  }

  // Build defaultLayout map: panelId → size
  const defaultLayout: Layout = {}
  node.children.forEach((child, i) => {
    defaultLayout[child.id] = node.sizes[i] ?? 50
  })

  return (
    <Group
      orientation={node.direction === 'horizontal' ? 'horizontal' : 'vertical'}
      defaultLayout={defaultLayout}
      onLayoutChanged={handleLayoutChanged}
      className="h-full"
    >
      {node.children.map((child, i) => (
        <>
          {i > 0 && (
            <Separator
              className={[
                node.direction === 'horizontal'
                  ? 'w-1 hover:w-1.5 cursor-col-resize'
                  : 'h-1 hover:h-1.5 cursor-row-resize',
                'bg-neutral-800 hover:bg-blue-600/50 transition-all shrink-0',
              ].join(' ')}
            />
          )}
          <Panel
            key={child.id}
            id={child.id}
            defaultSize={node.sizes[i] ?? 50}
            minSize={15}
          >
            {renderChild(child)}
          </Panel>
        </>
      ))}
    </Group>
  )
}
