import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Background,
  Connection,
  Controls,
  Edge,
  EdgeChange,
  MarkerType,
  NodeChange,
  ReactFlow,
  ReactFlowInstance
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Plus } from 'lucide-react'
import { StepFlowNode, StepNode } from './StepNode'
import { StartFlowNode, StartNode } from './StartNode'
import { FlowContextMenu, FlowMenuState } from './FlowContextMenu'
import { useLessonStore } from '../../store/useLessonStore'
import { useFileSystemStore } from '../../store/useFileSystemStore'
import { useIDEStore } from '../../store/useIDEStore'
import { getNextStep, usePlayerStore } from '../../store/usePlayerStore'
import { findNode, flattenSteps, primaryKind } from '../../lib/tree'
import { describeAction } from '../../engine/ExecutionEngine'
import { openNode } from '../../lib/lessonActions'
import { branchesOf, isBranchHandle, setBranchTarget, setJump } from '../../lib/branches'

type FlowNode = StepFlowNode | StartFlowNode

const nodeTypes = { step: StepNode, start: StartNode }

const edgeOptions = {
  type: 'smoothstep',
  markerEnd: { type: MarkerType.ArrowClosed },
  style: { strokeWidth: 2 }
}

const BRANCH_COLORS = { CHOICE: '#e879f9', CONDITION: '#fbbf24', GOTO: '#9ca3af' }

/** Data of a path edge, so removing it clears the path. */
interface BranchEdgeData extends Record<string, unknown> {
  stepId: string
  handle: string
}

const START_ID = 'start-node'
const START_X = 0
const ROW_Y = 0
const SPACING_X = 240

const FlowEditor = ({ flowId }: { flowId: string }): React.JSX.Element => {
  const tree = useLessonStore((s) => s.tree)
  const selectedNodeId = useLessonStore((s) => s.selectedNodeId)
  const rootPath = useFileSystemStore((s) => s.rootPath)
  const history = usePlayerStore((s) => s.history)
  const runningStepId = usePlayerStore((s) => s.runningStepId)
  const [menu, setMenu] = useState<FlowMenuState | null>(null)
  /** Card being dragged and where it is, until it is dropped. */
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null)
  /**
   * Card sizes measured by React Flow. Nodes given without them are hidden and measured again,
   * which made the cards flicker while dragging.
   */
  const [sizes, setSizes] = useState<Record<string, { width: number; height: number }>>({})
  /** Edges are derived from the steps, so their selection lives here. */
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null)
  const instanceRef = useRef<ReactFlowInstance<FlowNode, Edge> | null>(null)

  const flow = findNode(tree, flowId)
  const steps = useMemo(() => (flow?.type === 'FLOW' ? (flow.children ?? []) : []), [flow])

  const nodes = useMemo<FlowNode[]>(() => {
    const all = flattenSteps(tree)
    const numbers = new Map(all.map((s, i) => [s.id, i + 1]))
    const inFlow = new Set(steps.map((s) => s.id))
    const executed = new Set(history.map((h) => h.stepId))
    const nextId = getNextStep(tree, history)?.id
    return [
      {
        id: START_ID,
        type: 'start',
        position: { x: START_X, y: ROW_Y + 18 },
        measured: sizes[START_ID],
        data: {},
        draggable: false,
        selectable: false,
        deletable: false
      },
      ...steps.map(
        (step, index): StepFlowNode => ({
          id: step.id,
          type: 'step',
          position:
            drag?.id === step.id
              ? { x: drag.x, y: drag.y }
              : { x: START_X + 130 + index * SPACING_X, y: ROW_Y },
          measured: sizes[step.id],
          draggable: true,
          deletable: false,
          selected: step.id === selectedNodeId,
          data: {
            title: step.title,
            subtitle: step.data?.actions[0] ? describeAction(step.data.actions[0], rootPath) : '',
            actions: step.data?.actions.length ?? 0,
            number: numbers.get(step.id) ?? index + 1,
            kind: primaryKind(step),
            executed: executed.has(step.id),
            next: step.id === nextId,
            running: step.id === runningStepId,
            branches: branchesOf(step).map((b) => {
              const target = b.target ? all.find((s) => s.id === b.target) : undefined
              return {
                handle: b.handle,
                kind: b.kind,
                label: b.label,
                // Targets in other flows can't be drawn here: the card names them.
                outside:
                  target && !inFlow.has(target.id)
                    ? `→ ${numbers.get(target.id)}. ${target.title}`
                    : undefined,
                linked: !!target
              }
            })
          }
        })
      )
    ]
  }, [steps, tree, history, selectedNodeId, rootPath, runningStepId, drag, sizes])

  const edges = useMemo<Edge[]>(() => {
    const ids = [START_ID, ...steps.map((s) => s.id)]
    const inFlow = new Set(ids)
    // A step whose every path has a target never follows the list: its order link fades.
    const fixedNext = new Set(
      steps
        .filter((s) => {
          const branches = branchesOf(s)
          return branches.length > 0 && branches.every((b) => b.target)
        })
        .map((s) => s.id)
    )
    const sequence: Edge[] = ids.slice(1).map((target, i) => ({
      id: `e-${ids[i]}-${target}`,
      source: ids[i],
      target,
      sourceHandle: 'r',
      targetHandle: 'l',
      deletable: true,
      selected: `e-${ids[i]}-${target}` === selectedEdge,
      ...edgeOptions,
      ...(fixedNext.has(ids[i])
        ? { style: { strokeWidth: 1.5, strokeDasharray: '4 4', opacity: 0.35 } }
        : {})
    }))
    const paths: Edge[] = steps.flatMap((step) =>
      branchesOf(step)
        .filter((b) => b.target && inFlow.has(b.target))
        .map((b) => {
          const id = `b-${step.id}-${b.handle}`
          const data: BranchEdgeData = { stepId: step.id, handle: b.handle }
          return {
            id,
            source: step.id,
            sourceHandle: b.handle,
            target: b.target!,
            targetHandle: 't',
            type: 'default',
            deletable: true,
            selected: id === selectedEdge,
            animated: true,
            label: b.label,
            labelStyle: { fill: '#e5e7eb', fontSize: 11 },
            labelBgStyle: { fill: '#1f2937' },
            markerEnd: { type: MarkerType.ArrowClosed, color: BRANCH_COLORS[b.kind] },
            style: { strokeWidth: 2, stroke: BRANCH_COLORS[b.kind] },
            data
          }
        })
    )
    return [...sequence, ...paths]
  }, [steps, selectedEdge])

  // Re-fit the view when steps are added or removed.
  useEffect(() => {
    const timer = setTimeout(
      () => instanceRef.current?.fitView({ padding: 0.3, duration: 200, maxZoom: 1.2 }),
      50
    )
    return () => clearTimeout(timer)
  }, [steps.length])

  /**
   * Connecting A → B makes B come right after A (Start → B makes it the first step).
   * From a path handle it sets where that path leads; from the bottom handle, a "go to".
   */
  const onConnect = useCallback(
    ({ source, target, sourceHandle }: Connection) => {
      if (!source || !target || source === target) return
      if (isBranchHandle(sourceHandle)) return setBranchTarget(source, sourceHandle, target)
      if (sourceHandle === 'jump') {
        if (target !== START_ID) setJump(source, target)
        return
      }
      const lesson = useLessonStore.getState()
      if (source === START_ID) lesson.placeFirst(target, flowId)
      else lesson.placeAfter(target, source)
    },
    [flowId]
  )

  /** Keeps the measured sizes and the dragged card's position; selection lives in the lesson store. */
  const onNodesChange = useCallback((changes: NodeChange<FlowNode>[]) => {
    for (const change of changes) {
      if (change.type === 'dimensions' && change.dimensions) {
        const { width, height } = change.dimensions
        setSizes((current) =>
          current[change.id]?.width === width && current[change.id]?.height === height
            ? current
            : { ...current, [change.id]: { width, height } }
        )
      } else if (change.type === 'position' && change.dragging && change.position) {
        setDrag({ id: change.id, x: change.position.x, y: change.position.y })
      }
    }
  }, [])

  /** Dropping a step to the left or right of others changes its position in the flow. */
  const onNodeDragStop = useCallback(
    (_: unknown, node: FlowNode) => {
      if (node.id === START_ID) return
      const others = steps.filter((s) => s.id !== node.id)
      const slot = Math.round((node.position.x - START_X - 130) / SPACING_X)
      const index = Math.max(0, Math.min(others.length, slot))
      const lesson = useLessonStore.getState()
      if (steps[index]?.id !== node.id) {
        if (index === 0) lesson.placeFirst(node.id, flowId)
        else lesson.placeAfter(node.id, others[index - 1].id)
      }
      setDrag(null)
    },
    [steps, flowId]
  )

  /** Removing the link A → B sends B to the end of the flow. */
  const onEdgesChange = useCallback(
    (changes: EdgeChange<Edge>[]) => {
      const lesson = useLessonStore.getState()
      for (const change of changes) {
        if (change.type === 'select') {
          setSelectedEdge((current) =>
            change.selected ? change.id : current === change.id ? null : current
          )
        }
        if (change.type !== 'remove') continue
        setSelectedEdge(null)
        const edge = edges.find((e) => e.id === change.id)
        const branch = edge?.data as BranchEdgeData | undefined
        if (branch?.handle) {
          setBranchTarget(branch.stepId, branch.handle, undefined)
          continue
        }
        const last = steps[steps.length - 1]
        if (edge && last && edge.target !== last.id) lesson.placeAfter(edge.target, last.id)
      }
    },
    [edges, steps]
  )

  if (!flow || flow.type !== 'FLOW') {
    return (
      <div className="flex h-full items-center justify-center text-sm text-ide-muted">
        Este fluxo foi removido.
      </div>
    )
  }

  const addStep = (): void => {
    const id = useLessonStore.getState().addNode('STEP', flowId)
    useIDEStore.getState().openNodeTab(id, 'STEP')
  }

  return (
    <div className="relative h-full w-full">
      <div className="pointer-events-none absolute left-4 right-40 top-3 z-10">
        <div className="text-lg font-light text-white">{flow.title}</div>
        <div className="text-[12px] text-ide-muted">
          Arraste um passo para os lados para mudar a ordem · ligue a saída (direita) de um passo à
          entrada de outro para colocá-lo depois · puxe a bolinha de baixo para criar um “ir para” e
          as de cada opção de menu ou condição para escolher o caminho · Delete apaga a ligação
          selecionada · clique direito para mais opções
        </div>
      </div>
      <button
        onClick={addStep}
        className="absolute right-4 top-3 z-10 flex items-center gap-1.5 rounded bg-ide-accent px-3 py-1.5 text-[13px] text-white shadow hover:bg-sky-600"
      >
        <Plus size={14} /> Novo passo
      </button>

      <ReactFlow<FlowNode, Edge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onInit={(instance) => {
          instanceRef.current = instance
          instance.fitView({ padding: 0.3, maxZoom: 1.2 })
        }}
        onConnect={onConnect}
        onNodesChange={onNodesChange}
        onNodeDragStop={onNodeDragStop}
        onEdgesChange={onEdgesChange}
        onNodeClick={(_, node) =>
          node.id !== START_ID && useLessonStore.getState().selectNode(node.id)
        }
        onNodeDoubleClick={(_, node) => {
          const step = findNode(useLessonStore.getState().tree, node.id)
          if (step) openNode(step)
        }}
        onPaneClick={() => {
          setMenu(null)
          useLessonStore.getState().selectNode(null)
        }}
        onPaneContextMenu={(e) => {
          e.preventDefault()
          setMenu({ x: e.clientX, y: e.clientY })
        }}
        onEdgeContextMenu={(e, edge) => {
          e.preventDefault()
          const branch = edge.data as BranchEdgeData | undefined
          setMenu(
            branch?.handle
              ? {
                  x: e.clientX,
                  y: e.clientY,
                  branch: { stepId: branch.stepId, handle: branch.handle }
                }
              : { x: e.clientX, y: e.clientY, edgeTarget: edge.target }
          )
        }}
        onNodeContextMenu={(e, node) => {
          e.preventDefault()
          if (node.id === START_ID) return
          useLessonStore.getState().selectNode(node.id)
          setMenu({ x: e.clientX, y: e.clientY, stepId: node.id })
        }}
        nodesDraggable
        deleteKeyCode={['Delete', 'Backspace']}
        colorMode="dark"
        minZoom={0.2}
        proOptions={{ hideAttribution: true }}
      >
        <Controls showInteractive={false} />
        <Background gap={16} size={1} />
      </ReactFlow>

      {steps.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-ide-muted">
          Este fluxo ainda não tem passos.
        </div>
      )}

      <FlowContextMenu flowId={flowId} menu={menu} onClose={() => setMenu(null)} />
    </div>
  )
}

export default FlowEditor
