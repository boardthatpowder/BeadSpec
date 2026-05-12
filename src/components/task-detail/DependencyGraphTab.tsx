import { useCallback, useMemo, useEffect, useRef, useState, createContext, useContext } from 'react'
import cytoscape from 'cytoscape'
import { IconButton } from '../ui/IconButton'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  NodeTypes,
  Handle,
  Position,
  MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { commands, unwrap } from '../../ipc'
import type { TaskDetail } from '../../bindings'
import { listen } from '@tauri-apps/api/event'
import { useAppState } from '../../contexts/HashStateContext'
import { useNavigationHistory } from '../../hooks/useNavigationHistory'
import { useWorkspaceStore } from '../../stores/workspace'

interface TaskNode {
  id: string
  title: string
  status: string
  priority: number
  relation: 'self' | 'dependency' | 'dependent'
  branch: 'dependency' | 'dependent' | null
  hiddenCount: number
  isExpanded: boolean
}

const STATUS_BORDER: Record<string, string> = {
  open:        '#737373',
  in_progress: '#3b82f6',
  blocked:     '#f59e0b',
  closed:      '#22c55e',
}

const PRIORITY_LABEL: Record<number, { label: string; color: string }> = {
  1: { label: 'P1', color: '#ef4444' },
  2: { label: 'P2', color: '#f97316' },
  3: { label: 'P3', color: '#eab308' },
  4: { label: 'P4', color: '#737373' },
}

interface ExpandCtx { toggle: (id: string, branch: 'dependency' | 'dependent') => void }
const ExpandContext = createContext<ExpandCtx>({ toggle: () => {} })

function TaskNodeComponent({ data }: { data: TaskNode }) {
  const borderColor = STATUS_BORDER[data.status] ?? '#737373'
  const isSelf = data.relation === 'self'
  const isClosed = data.status === 'closed'
  const shortId = data.id.split('-').pop() ?? data.id
  const priority = PRIORITY_LABEL[data.priority]
  const openPinned = useWorkspaceStore(s => s.openPinned)
  const { toggle } = useContext(ExpandContext)

  return (
    <div
      title={isSelf ? undefined : `Open ${data.id}`}
      style={{
        borderColor,
        opacity: isClosed && !isSelf ? 0.55 : 1,
        boxShadow: isSelf ? `0 0 0 3px rgba(59,130,246,0.2), 0 4px 20px rgba(0,0,0,0.5)` : undefined,
      }}
      className={[
        'group px-3 py-2 rounded-lg bg-neutral-900 border-2 text-left min-w-44 max-w-56 shadow-lg transition-all',
        isSelf
          ? 'ring-2 ring-blue-400'
          : 'cursor-pointer hover:border-neutral-400 hover:shadow-xl hover:-translate-y-0.5',
      ].join(' ')}
    >
      <Handle type="target" position={Position.Left} className="!bg-neutral-700 !border-neutral-600" />

      {/* Header row: short id + priority + expand badge */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          {isSelf && (
            <span className="text-[9px] font-semibold uppercase tracking-wider text-blue-400 opacity-80">
              This task
            </span>
          )}
          {!isSelf && (
            <span className="font-mono text-[10px] text-neutral-500">{shortId}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {priority && (
            <span className="text-[10px] font-semibold" style={{ color: priority.color }}>
              {priority.label}
            </span>
          )}
          {/* Expand/collapse control — always visible on non-self nodes; active when hiddenCount > 0 */}
          {!isSelf && data.branch && (
            <button
              onClick={(e) => { e.stopPropagation(); if (data.hiddenCount > 0 || data.isExpanded) toggle(data.id, data.branch!) }}
              title={data.isExpanded ? 'Collapse' : data.hiddenCount > 0 ? `Expand ${data.hiddenCount} more` : 'No further dependencies'}
              disabled={data.hiddenCount === 0 && !data.isExpanded}
              className={[
                'flex items-center gap-0.5 text-[10px] font-medium px-1 rounded leading-none py-0.5 transition-all',
                data.hiddenCount > 0 || data.isExpanded
                  ? 'bg-neutral-700 hover:bg-neutral-600 text-neutral-200 cursor-pointer'
                  : 'text-neutral-600 cursor-default',
              ].join(' ')}
            >
              <svg
                className={['w-2.5 h-2.5 transition-transform', data.isExpanded ? 'rotate-90' : ''].join(' ')}
                viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8"
              >
                <path d="M3 2l4 3-4 3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {(data.hiddenCount > 0 && !data.isExpanded) && (
                <span>{data.hiddenCount}</span>
              )}
            </button>
          )}
          {/* Open in tab button — fades in on hover for non-self nodes */}
          {!isSelf && (
            <IconButton
              label="Open in new tab"
              onClick={(e) => { e.stopPropagation(); openPinned(data.id) }}
              className="w-4 h-4 flex items-center justify-center rounded text-neutral-500 opacity-0 group-hover:opacity-100 hover:text-neutral-200 hover:bg-neutral-700 transition-all"
            >
              <svg
                className="w-2.5 h-2.5"
                viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5"
              >
                <path d="M2 8L8 2M4 2h4v4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </IconButton>
          )}
        </div>
      </div>

      {/* Title — primary element */}
      <div className="text-xs text-neutral-100 font-medium leading-snug line-clamp-2 mb-1.5">
        {data.title}
      </div>

      {/* Status badge */}
      <div
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
        style={{ color: borderColor, backgroundColor: `${borderColor}22` }}
      >
        {isClosed && (
          <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1.5 5l2.5 2.5 4.5-4.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {data.status.replace('_', ' ')}
      </div>

      <Handle type="source" position={Position.Right} className="!bg-neutral-700 !border-neutral-600" />
    </div>
  )
}

const nodeTypes: NodeTypes = { task: TaskNodeComponent }

// Fetch TaskDetail for ids not yet in the map, writing results in-place.
async function fetchInto(map: Map<string, TaskDetail>, ids: string[], project: string) {
  const missing = ids.filter(id => !map.has(id))
  if (!missing.length) return
  const results = await Promise.all(
    missing.map(id => unwrap(commands.getTask(project, id)).catch(() => null))
  )
  results.forEach(t => { if (t) map.set(t.id, t) })
}

interface VisibleNode {
  detail: TaskDetail
  depth: number
  branch: 'dependency' | 'dependent' | null
  parentId: string | null
}

interface GraphResult {
  nodes: Node[]
  edges: Edge[]
  visibleIds: Set<string>
}

function buildGraph(
  task: TaskDetail,
  taskMap: Map<string, TaskDetail>,
  expandedDeps: Set<string>,
  expandedDependents: Set<string>,
): GraphResult {
  const visible = new Map<string, VisibleNode>()
  visible.set(task.id, { detail: task, depth: 0, branch: null, parentId: null })

  // BFS left: dep branch
  const depQueue: Array<{ id: string; depth: number; parentId: string }> = task.dependencies.map(id => ({ id, depth: -1, parentId: task.id }))
  let di = 0
  while (di < depQueue.length) {
    const { id, depth, parentId } = depQueue[di++]
    if (visible.has(id)) continue
    const detail = taskMap.get(id)
    if (!detail) {
      // Insert a placeholder so we can still render it
      visible.set(id, { detail: { id, title: id, status: 'open', priority: 2, dependencies: [], dependents: [] } as unknown as TaskDetail, depth, branch: 'dependency', parentId })
      continue
    }
    visible.set(id, { detail, depth, branch: 'dependency', parentId })
    if (expandedDeps.has(id)) {
      detail.dependencies.forEach(childId => {
        if (!visible.has(childId)) depQueue.push({ id: childId, depth: depth - 1, parentId: id })
      })
    }
  }

  // BFS right: dependent branch
  const dependentQueue: Array<{ id: string; depth: number; parentId: string }> = task.dependents.map(id => ({ id, depth: 1, parentId: task.id }))
  let qi = 0
  while (qi < dependentQueue.length) {
    const { id, depth, parentId } = dependentQueue[qi++]
    if (visible.has(id)) continue
    const detail = taskMap.get(id)
    if (!detail) {
      visible.set(id, { detail: { id, title: id, status: 'open', priority: 2, dependencies: [], dependents: [] } as unknown as TaskDetail, depth, branch: 'dependent', parentId })
      continue
    }
    visible.set(id, { detail, depth, branch: 'dependent', parentId })
    if (expandedDependents.has(id)) {
      detail.dependents.forEach(childId => {
        if (!visible.has(childId)) dependentQueue.push({ id: childId, depth: depth + 1, parentId: id })
      })
    }
  }

  // Group by depth for layout
  const byDepth = new Map<number, string[]>()
  visible.forEach((v, id) => {
    const col = byDepth.get(v.depth) ?? []
    col.push(id)
    byDepth.set(v.depth, col)
  })

  const selfY = 200
  const columnWidth = 320
  const rowHeight = 110

  // Assign positions
  const positions = new Map<string, { x: number; y: number }>()
  byDepth.forEach((ids, depth) => {
    const x = 300 + depth * columnWidth
    const totalHeight = (ids.length - 1) * rowHeight
    ids.forEach((id, i) => {
      positions.set(id, { x, y: selfY - totalHeight / 2 + i * rowHeight })
    })
  })

  // Build nodes
  const nodes: Node[] = []
  visible.forEach((v, id) => {
    const detail = v.detail
    const pos = positions.get(id) ?? { x: 300, y: 200 }

    let hiddenCount = 0
    if (id !== task.id && v.branch === 'dependency') {
      hiddenCount = (detail.dependencies ?? []).filter(c => !visible.has(c)).length
    } else if (id !== task.id && v.branch === 'dependent') {
      hiddenCount = (detail.dependents ?? []).filter(c => !visible.has(c)).length
    }

    nodes.push({
      id,
      type: 'task',
      position: pos,
      data: {
        id,
        title: detail.title,
        status: detail.status,
        priority: detail.priority,
        relation: id === task.id ? 'self' : v.branch === 'dependency' ? 'dependency' : 'dependent',
        branch: v.branch,
        hiddenCount,
        isExpanded: v.branch === 'dependency' ? expandedDeps.has(id) : expandedDependents.has(id),
      } satisfies TaskNode,
    })
  })

  // Build edges
  const edges: Edge[] = []
  visible.forEach((v, id) => {
    if (!v.parentId) return
    const sourceDetail = taskMap.get(v.branch === 'dependency' ? id : v.parentId)
    const isBlocked = sourceDetail?.status === 'blocked'
    const isInProgress = sourceDetail?.status === 'in_progress'
    const edgeColor = isBlocked ? '#f59e0b' : '#737373'

    if (v.branch === 'dependency') {
      edges.push({
        id: `e-${id}-${v.parentId}`,
        source: id,
        target: v.parentId,
        style: { stroke: edgeColor },
        markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor },
        animated: isInProgress,
      })
    } else {
      edges.push({
        id: `e-${v.parentId}-${id}`,
        source: v.parentId,
        target: id,
        style: { stroke: '#737373' },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#737373' },
      })
    }
  })

  return { nodes, edges, visibleIds: new Set(visible.keys()) }
}

interface EnrichedNode {
  id: string
  title: string
  status: string
  relation: string
  branch: 'dependency' | 'dependent' | null
  hiddenCount: number
  isExpanded: boolean
}

interface Props { task: TaskDetail; project: string }

export function DependencyGraphTab({ task, project }: Props) {
  const { setState } = useAppState()
  const { pushTask } = useNavigationHistory()
  const queryClient = useQueryClient()

  const [expandedDeps, setExpandedDeps] = useState<Set<string>>(new Set())
  const [expandedDependents, setExpandedDependents] = useState<Set<string>>(new Set())

  // Reset expansion when the focal task changes
  useEffect(() => {
    setExpandedDeps(new Set())
    setExpandedDependents(new Set())
  }, [task.id])

  const toggleExpand = useCallback((id: string, branch: 'dependency' | 'dependent') => {
    const setter = branch === 'dependency' ? setExpandedDeps : setExpandedDependents
    setter(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  // Track all visible ids for realtime invalidation (updated when query resolves)
  const visibleIdsRef = useRef<Set<string>>(new Set([task.id]))

  // Listen for tasks_changed events and invalidate when a visible id is affected
  useEffect(() => {
    const unlisten = listen<{ task_ids: string[] }>('tasks_changed', (e) => {
      if (e.payload.task_ids.some(id => visibleIdsRef.current.has(id))) {
        queryClient.invalidateQueries({ queryKey: ['dep-graph', project, task.id] })
      }
    })
    return () => { unlisten.then(fn => fn()) }
  }, [task.id, project, queryClient])

  // BFS-driven fetch: 1-hop always, plus transitive ids for expanded nodes
  const expandedDepsSorted = useMemo(() => [...expandedDeps].sort(), [expandedDeps])
  const expandedDependentsSorted = useMemo(() => [...expandedDependents].sort(), [expandedDependents])

  const { data: taskMap = new Map<string, TaskDetail>() } = useQuery({
    queryKey: ['dep-graph', project, task.id, expandedDepsSorted, expandedDependentsSorted],
    queryFn: async () => {
      const map = new Map<string, TaskDetail>([[task.id, task]])

      // Layer 0: 1-hop
      await fetchInto(map, [...task.dependencies, ...task.dependents], project)

      // Layer 1+: for each expanded node, fetch its direction-locked children
      // Repeat until no new ids discovered (handles multi-level expansion, cycle-safe)
      let frontier = [
        ...expandedDepsSorted.flatMap(id => map.get(id)?.dependencies ?? []),
        ...expandedDependentsSorted.flatMap(id => map.get(id)?.dependents ?? []),
      ]
      while (frontier.length) {
        const before = map.size
        await fetchInto(map, frontier, project)
        if (map.size === before) break
        // Collect next frontier: newly fetched nodes that are themselves expanded
        frontier = [
          ...expandedDepsSorted.flatMap(id => map.get(id)?.dependencies ?? []),
          ...expandedDependentsSorted.flatMap(id => map.get(id)?.dependents ?? []),
        ].filter(id => !map.has(id))
      }

      return map
    },
    enabled: !!(task.dependencies.length || task.dependents.length) && !!project,
    staleTime: 30_000,
  })

  const { nodes, edges, visibleIds } = useMemo(
    () => buildGraph(task, taskMap, expandedDeps, expandedDependents),
    [task, taskMap, expandedDeps, expandedDependents]
  )

  // Keep the visible-ids ref current for the realtime listener
  useEffect(() => { visibleIdsRef.current = visibleIds }, [visibleIds])

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.id === task.id) return
    pushTask(task.id)
    setState({ taskId: node.id })
  }, [task.id, pushTask, setState])

  if (!task.dependencies?.length && !task.dependents?.length) {
    return (
      <div style={{ position: 'absolute', inset: 0, background: '#0a0a0a' }} className="flex items-center justify-center text-neutral-400 text-sm">
        No dependencies
      </div>
    )
  }

  const enrichedNodes: EnrichedNode[] = nodes.map(n => {
    const d = n.data as unknown as TaskNode
    return { id: n.id, title: d.title, status: d.status, relation: d.relation, branch: d.branch, hiddenCount: d.hiddenCount, isExpanded: d.isExpanded }
  })

  const enrichedEdges = edges.map(e => ({
    source: e.source,
    target: e.target,
    blocked: (e.style as React.CSSProperties | undefined)?.stroke === '#f59e0b',
  }))

  const onCyNodeClick = useCallback((id: string) => {
    if (id !== task.id) { pushTask(task.id); setState({ taskId: id }) }
  }, [task.id, pushTask, setState])

  if (nodes.length > 50) {
    return (
      <ExpandContext.Provider value={{ toggle: toggleExpand }}>
        <CytoscapeGraph
          nodes={enrichedNodes}
          edges={enrichedEdges}
          onNodeClick={onCyNodeClick}
          onToggle={toggleExpand}
        />
      </ExpandContext.Provider>
    )
  }

  return (
    <ExpandContext.Provider value={{ toggle: toggleExpand }}>
      <div style={{ position: 'absolute', inset: 0, background: '#0a0a0a' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          fitView
          colorMode="dark"
          proOptions={{ hideAttribution: true }}
          style={{ background: '#0a0a0a' }}
        >
          <Background color="#262626" gap={20} />
          <Controls className="!bg-neutral-900 !border-neutral-700" />
          <MiniMap
            nodeColor={n => STATUS_BORDER[(n.data as unknown as TaskNode).status] ?? '#525252'}
            className="!bg-neutral-900 !border-neutral-700"
          />
        </ReactFlow>
      </div>
    </ExpandContext.Provider>
  )
}

function CytoscapeGraph({ nodes, edges, onNodeClick, onToggle }: {
  nodes: EnrichedNode[]
  edges: Array<{ source: string; target: string; blocked: boolean }>
  onNodeClick: (id: string) => void
  onToggle: (id: string, branch: 'dependency' | 'dependent') => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<cytoscape.Core | null>(null)
  const [badges, setBadges] = useState<Array<{ id: string; x: number; y: number; hiddenCount: number; isExpanded: boolean; branch: 'dependency' | 'dependent' }>>([])

  const updateBadgePositions = useCallback(() => {
    if (!cyRef.current) return
    const cy = cyRef.current
    const result: typeof badges = []
    nodes.forEach(n => {
      if (n.relation === 'self' || !n.branch || n.hiddenCount <= 0) return
      const cyNode = cy.getElementById(n.id)
      if (!cyNode.length) return
      const pos = cyNode.renderedPosition()
      const w = cyNode.renderedWidth()
      result.push({ id: n.id, x: pos.x + w / 2 - 2, y: pos.y - cyNode.renderedHeight() / 2 - 2, hiddenCount: n.hiddenCount, isExpanded: n.isExpanded, branch: n.branch })
    })
    setBadges(result)
  }, [nodes])

  useEffect(() => {
    if (!containerRef.current) return

    const STATUS_COLOR: Record<string, string> = {
      open: '#737373', in_progress: '#3b82f6', blocked: '#f59e0b', closed: '#22c55e',
    }

    cyRef.current = cytoscape({
      container: containerRef.current,
      elements: [
        ...nodes.map(n => ({
          data: {
            id: n.id,
            label: `${n.id.split('-').pop()}\n${n.title.slice(0, 20)}`,
            statusColor: STATUS_COLOR[n.status] ?? '#737373',
            borderWidth: n.relation === 'self' ? 3 : 2,
            nodeOpacity: n.status === 'closed' ? 0.5 : 1,
          },
        })),
        ...edges.map(e => ({
          data: {
            id: `${e.source}-${e.target}`,
            source: e.source,
            target: e.target,
            edgeColor: e.blocked ? '#f59e0b' : '#525252',
          },
        })),
      ],
      style: [
        {
          selector: 'node',
          style: {
            label: 'data(label)',
            color: '#e5e5e5',
            'font-size': 10,
            'text-wrap': 'wrap',
            'text-max-width': '80px',
            width: 80,
            height: 40,
            shape: 'roundrectangle',
            'background-color': '#171717',
            'border-color': 'data(statusColor)',
            'border-width': 'data(borderWidth)',
            opacity: 'data(nodeOpacity)',
          } as unknown as cytoscape.Css.Node,
        },
        {
          selector: 'edge',
          style: {
            width: 1.5,
            'curve-style': 'bezier',
            'target-arrow-shape': 'triangle',
            'line-color': 'data(edgeColor)',
            'target-arrow-color': 'data(edgeColor)',
          } as unknown as cytoscape.Css.Edge,
        },
      ],
      layout: { name: 'breadthfirst', directed: true, padding: 20 } as cytoscape.LayoutOptions,
      userZoomingEnabled: true,
      userPanningEnabled: true,
    })

    cyRef.current.on('tap', 'node', (e) => onNodeClick(e.target.id()))
    cyRef.current.on('mouseover', 'node', () => { if (containerRef.current) containerRef.current.style.cursor = 'pointer' })
    cyRef.current.on('mouseout', 'node', () => { if (containerRef.current) containerRef.current.style.cursor = '' })
    cyRef.current.on('render pan zoom layoutstop', updateBadgePositions)

    // Initial badge positions after layout settles
    cyRef.current.one('layoutstop', updateBadgePositions)

    return () => cyRef.current?.destroy()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, onNodeClick])

  // Keep badge positions in sync when updateBadgePositions changes (nodes list changed)
  useEffect(() => {
    if (!cyRef.current) return
    cyRef.current.off('render pan zoom layoutstop')
    cyRef.current.on('render pan zoom layoutstop', updateBadgePositions)
  }, [updateBadgePositions])

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#0a0a0a', overflow: 'hidden' }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0, background: '#0a0a0a' }} />
      {badges.map(b => (
        <button
          key={b.id}
          onClick={(e) => { e.stopPropagation(); onToggle(b.id, b.branch) }}
          title={b.isExpanded ? 'Collapse' : `Expand ${b.hiddenCount} more`}
          style={{ position: 'absolute', left: b.x, top: b.y, transform: 'translate(-50%, -50%)' }}
          className="text-[9px] font-medium px-1 rounded bg-neutral-700 hover:bg-neutral-600 text-neutral-300 transition-colors leading-none py-0.5 z-10 pointer-events-auto"
        >
          {b.isExpanded ? '−' : `+${b.hiddenCount}`}
        </button>
      ))}
    </div>
  )
}
