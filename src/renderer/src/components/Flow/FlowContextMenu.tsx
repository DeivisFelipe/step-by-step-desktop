import { ArrowLeft, ArrowRight, Edit, Play, Plus, Trash, Type } from 'lucide-react'
import ContextMenu, { ContextMenuItem } from '../UI/ContextMenu'
import { useLessonStore } from '../../store/useLessonStore'
import { useIDEStore } from '../../store/useIDEStore'
import { usePlayerStore } from '../../store/usePlayerStore'
import { findNode } from '../../lib/tree'
import { deleteNode, openNode, renameNode } from '../../lib/lessonActions'

export interface FlowMenuState {
  x: number
  y: number
  /** Step id for a node menu; absent for the pane menu. */
  stepId?: string
}

interface FlowContextMenuProps {
  flowId: string
  menu: FlowMenuState | null
  onClose: () => void
}

export const FlowContextMenu = ({
  flowId,
  menu,
  onClose
}: FlowContextMenuProps): React.JSX.Element => {
  const lesson = useLessonStore.getState

  const withStep = (fn: (id: string) => void) => (): void => {
    if (menu?.stepId) fn(menu.stepId)
  }

  const items: ContextMenuItem[] = menu?.stepId
    ? [
        {
          label: 'Executar passo',
          icon: Play,
          action: withStep((id) => usePlayerStore.getState().runStep(id))
        },
        {
          label: 'Editar passo',
          icon: Edit,
          action: withStep((id) => {
            const node = findNode(lesson().tree, id)
            if (node) openNode(node)
          })
        },
        {
          label: 'Renomear',
          icon: Type,
          action: withStep((id) => {
            const node = findNode(lesson().tree, id)
            if (node) renameNode(node)
          })
        },
        {
          label: 'Mover para a esquerda',
          icon: ArrowLeft,
          separator: true,
          action: withStep((id) => lesson().reorderNode(id, 'up'))
        },
        {
          label: 'Mover para a direita',
          icon: ArrowRight,
          action: withStep((id) => lesson().reorderNode(id, 'down'))
        },
        {
          label: 'Excluir',
          icon: Trash,
          danger: true,
          separator: true,
          action: withStep((id) => {
            const node = findNode(lesson().tree, id)
            if (node) deleteNode(node)
          })
        }
      ]
    : [
        {
          label: 'Novo passo',
          icon: Plus,
          action: () => {
            const id = lesson().addNode('STEP', flowId)
            useIDEStore.getState().openNodeTab(id, 'STEP')
          }
        }
      ]

  return <ContextMenu position={menu} items={items} onClose={onClose} />
}
