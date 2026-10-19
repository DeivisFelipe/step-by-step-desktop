import { useState } from 'react'
import clsx from 'clsx'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronRight,
  Copy,
  Edit,
  FileCode,
  Folder,
  FolderOpen,
  Loader2,
  Play,
  Plus,
  Terminal,
  Trash
} from 'lucide-react'
import { LessonNode } from '../../types/schema'
import { useLessonStore } from '../../store/useLessonStore'
import { useIDEStore } from '../../store/useIDEStore'
import { usePlayerStore } from '../../store/usePlayerStore'
import { deleteNode, openNode, renameNode } from '../../lib/lessonActions'
import ContextMenu, { ContextMenuItem } from '../UI/ContextMenu'

interface StepItemProps {
  node: LessonNode
  depth: number
  /** Position of the step in the whole lesson (1-based), steps only. */
  number?: number
  isExecuted: boolean
  isNext: boolean
}

const StepItem = ({
  node,
  depth,
  number,
  isExecuted,
  isNext
}: StepItemProps): React.JSX.Element => {
  const isSelected = useLessonStore((s) => s.selectedNodeId === node.id)
  const isRunning = usePlayerStore((s) => s.runningStepId === node.id)
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node.id
  })

  const isFlow = node.type === 'FLOW'
  const lesson = useLessonStore.getState

  const addStepHere = (): void => {
    const id = lesson().addNode('STEP', node.id)
    useIDEStore.getState().openNodeTab(id, 'STEP')
  }

  const menuItems: ContextMenuItem[] = [
    ...(isFlow
      ? []
      : [
          {
            label: 'Executar passo',
            icon: Play,
            action: () => usePlayerStore.getState().runStep(node.id)
          }
        ]),
    { label: isFlow ? 'Abrir diagrama' : 'Editar passo', icon: Edit, action: () => openNode(node) },
    {
      label: isFlow ? 'Novo passo no fluxo' : 'Novo passo abaixo',
      icon: Plus,
      separator: true,
      action: addStepHere
    },
    { label: 'Renomear', icon: Edit, shortcut: 'F2', action: () => renameNode(node) },
    { label: 'Duplicar', icon: Copy, action: () => lesson().duplicateNode(node.id) },
    {
      label: 'Mover para cima',
      icon: ArrowUp,
      separator: true,
      action: () => lesson().reorderNode(node.id, 'up')
    },
    {
      label: 'Mover para baixo',
      icon: ArrowDown,
      action: () => lesson().reorderNode(node.id, 'down')
    },
    { label: 'Excluir', icon: Trash, danger: true, separator: true, action: () => deleteNode(node) }
  ]

  const kindIcon = isFlow ? (
    node.isExpanded ? (
      <FolderOpen size={16} className="text-[#dcb67a]" />
    ) : (
      <Folder size={16} className="text-[#dcb67a]" />
    )
  ) : node.data?.action.kind === 'TERMINAL' ? (
    <Terminal size={16} className="text-purple-400" />
  ) : (
    <FileCode size={16} className="text-sky-400" />
  )

  return (
    <>
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        role="treeitem"
        aria-selected={isSelected}
        tabIndex={-1}
        style={{
          paddingLeft: `${depth * 14 + 6}px`,
          transform: CSS.Translate.toString(transform),
          transition
        }}
        className={clsx(
          'group relative flex cursor-pointer select-none items-center py-[3px] pr-2 outline-none',
          isSelected ? 'bg-ide-active text-white' : 'hover:bg-ide-hover',
          isDragging && 'z-10 opacity-50',
          isNext && !isSelected && 'bg-sky-900/30'
        )}
        onClick={(e) => {
          e.stopPropagation()
          openNode(node)
        }}
        onDoubleClick={() => {
          if (!isFlow) usePlayerStore.getState().runStep(node.id)
        }}
        onKeyDown={(e) => {
          if (e.key === 'F2') renameNode(node)
          else if (e.key === 'Delete') deleteNode(node)
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          lesson().selectNode(node.id)
          setMenuPos({ x: e.clientX, y: e.clientY })
        }}
      >
        {isNext && <div className="absolute bottom-0 left-0 top-0 w-0.5 bg-sky-400" />}
        <span
          className={clsx(
            'mr-0.5 flex w-4 flex-none justify-center text-gray-400 transition-transform duration-100',
            node.isExpanded && 'rotate-90'
          )}
          onClick={(e) => {
            if (!isFlow) return
            e.stopPropagation()
            lesson().updateNode(node.id, { isExpanded: !node.isExpanded })
          }}
        >
          {isFlow && <ChevronRight size={14} />}
        </span>
        <span className="mr-1.5 flex-none">{kindIcon}</span>
        {number !== undefined && (
          <span className="mr-1.5 w-5 flex-none text-right text-[11px] tabular-nums text-ide-muted">
            {number}
          </span>
        )}
        <span
          className={clsx(
            'flex-1 truncate text-[13px]',
            isFlow && 'font-semibold',
            isExecuted && !isSelected && 'text-gray-400'
          )}
        >
          {node.title}
        </span>
        {isRunning ? (
          <Loader2 size={14} className="ml-1 flex-none animate-spin text-sky-400" />
        ) : isExecuted ? (
          <CheckCircle2 size={14} className="ml-1 flex-none text-green-500" />
        ) : (
          !isFlow && (
            <button
              className="ml-1 hidden flex-none rounded p-0.5 text-gray-300 hover:bg-ide-border group-hover:block"
              title="Executar passo"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                usePlayerStore.getState().runStep(node.id)
              }}
            >
              <Play size={12} />
            </button>
          )
        )}
      </div>

      <ContextMenu position={menuPos} items={menuItems} onClose={() => setMenuPos(null)} />
    </>
  )
}

export default StepItem
