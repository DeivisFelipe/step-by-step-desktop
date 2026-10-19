import { useMemo } from 'react'
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useLessonStore } from '../../store/useLessonStore'
import { getNextStep, usePlayerStore } from '../../store/usePlayerStore'
import { LessonNode } from '../../types/schema'
import StepItem from './StepItem'

interface Row {
  node: LessonNode
  depth: number
  number?: number
}

/** Visible rows in display order; rendered flat so drag & drop works across levels. */
function visibleRows(tree: LessonNode[]): Row[] {
  const rows: Row[] = []
  let stepNumber = 0
  const walk = (nodes: LessonNode[], depth: number, visible: boolean): void => {
    for (const node of nodes) {
      if (node.type === 'STEP') stepNumber++
      if (visible) {
        rows.push({ node, depth, number: node.type === 'STEP' ? stepNumber : undefined })
      }
      if (node.children) walk(node.children, depth + 1, visible && !!node.isExpanded)
    }
  }
  walk(tree, 0, true)
  return rows
}

const StepTree = (): React.JSX.Element => {
  const tree = useLessonStore((s) => s.tree)
  const history = usePlayerStore((s) => s.history)

  const rows = useMemo(() => visibleRows(tree), [tree])
  const executed = useMemo(() => new Set(history.map((h) => h.stepId)), [history])
  const nextId = useMemo(() => getNextStep(tree, history)?.id ?? null, [tree, history])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const handleDragEnd = ({ active, over }: DragEndEvent): void => {
    if (over && active.id !== over.id) {
      useLessonStore.getState().moveNode(String(active.id), String(over.id))
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={rows.map((r) => r.node.id)} strategy={verticalListSortingStrategy}>
        <div role="tree">
          {rows.map(({ node, depth, number }) => (
            <StepItem
              key={node.id}
              node={node}
              depth={depth}
              number={number}
              isExecuted={executed.has(node.id)}
              isNext={node.id === nextId}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

export default StepTree
