import {
  ArrowLeft,
  ArrowRight,
  CornerDownRight,
  Edit,
  Play,
  Plus,
  Signpost,
  Split,
  Trash,
  Type,
  Unlink
} from 'lucide-react'
import ContextMenu, { ContextMenuItem } from '../UI/ContextMenu'
import { useLessonStore } from '../../store/useLessonStore'
import { useIDEStore } from '../../store/useIDEStore'
import { usePlayerStore } from '../../store/usePlayerStore'
import { findNode } from '../../lib/tree'
import { deleteNode, openNode, renameNode } from '../../lib/lessonActions'
import { setBranchTarget } from '../../lib/branches'
import { ActionKind } from '../../types/schema'

export interface FlowMenuState {
  x: number
  y: number
  /** Step id for a node menu; absent for the pane menu. */
  stepId?: string
  /** Step a link points to, for the link menu. */
  edgeTarget?: string
  /** A path link (menu option, condition, go to). */
  branch?: { stepId: string; handle: string }
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

  /** Adds a path action to the step and opens it to fill in. */
  const addPath = (stepId: string, kind: ActionKind): void => {
    lesson().addAction(stepId, kind)
    useIDEStore.getState().openNodeTab(stepId, 'STEP')
  }

  /** New step that only holds a path action (a menu or an if/else of its own). */
  const newPathStep = (kind: ActionKind, title: string): void => {
    const id = lesson().addNode('STEP', flowId, title)
    const step = findNode(lesson().tree, id)
    for (const action of step?.data?.actions ?? []) lesson().removeAction(id, action.id)
    lesson().addAction(id, kind)
    useIDEStore.getState().openNodeTab(id, 'STEP')
  }

  const unlink: ContextMenuItem[] = menu?.edgeTarget
    ? [
        {
          label: 'Remover ligação (o passo vai para o fim do fluxo)',
          icon: Unlink,
          action: () => {
            const flow = findNode(lesson().tree, flowId)
            const last = flow?.children?.[flow.children.length - 1]
            if (last && last.id !== menu.edgeTarget) lesson().placeAfter(menu.edgeTarget!, last.id)
          }
        }
      ]
    : []

  const items: ContextMenuItem[] = menu?.branch
    ? [
        {
          label: 'Remover caminho (volta a seguir a lista)',
          icon: Unlink,
          action: () => setBranchTarget(menu.branch!.stepId, menu.branch!.handle, undefined)
        }
      ]
    : menu?.edgeTarget
      ? unlink
      : menu?.stepId
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
              label: 'Adicionar menu de escolha',
              icon: Signpost,
              separator: true,
              action: withStep((id) => addPath(id, 'CHOICE'))
            },
            {
              label: 'Adicionar se / senão',
              icon: Split,
              action: withStep((id) => addPath(id, 'CONDITION'))
            },
            {
              label: 'Adicionar ir para',
              icon: CornerDownRight,
              action: withStep((id) => addPath(id, 'GOTO'))
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
            },
            {
              label: 'Novo menu de escolha',
              icon: Signpost,
              action: () => newPathStep('CHOICE', 'Menu')
            },
            {
              label: 'Novo se / senão',
              icon: Split,
              action: () => newPathStep('CONDITION', 'Condição')
            }
          ]

  return <ContextMenu position={menu} items={items} onClose={onClose} />
}
