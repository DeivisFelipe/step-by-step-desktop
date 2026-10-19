import { LessonNode } from '../types/schema'
import { useIDEStore } from '../store/useIDEStore'
import { useLessonStore } from '../store/useLessonStore'
import { collectIds } from './tree'

// UI actions on lesson nodes shared by the outline, the flow diagram and the step editor.

export async function renameNode(node: LessonNode): Promise<void> {
  const title = await useIDEStore
    .getState()
    .askText(node.type === 'FLOW' ? 'Nome do fluxo' : 'Nome do passo', node.title)
  if (title) useLessonStore.getState().updateNode(node.id, { title })
}

export async function deleteNode(node: LessonNode): Promise<void> {
  const count = collectIds(node).length - 1
  const choice = await window.api.showMessage({
    type: 'warning',
    message: `Excluir "${node.title}"?`,
    detail:
      node.type === 'FLOW' && count > 0
        ? `O fluxo e seus ${count} passo(s) serão removidos da aula.`
        : `O ${node.type === 'FLOW' ? 'fluxo' : 'passo'} será removido da aula.`,
    buttons: ['Excluir', 'Cancelar'],
    defaultId: 1,
    cancelId: 1
  })
  if (choice === 0) useLessonStore.getState().removeNode(node.id)
}

export function openNode(node: LessonNode): void {
  useLessonStore.getState().selectNode(node.id)
  useIDEStore.getState().openNodeTab(node.id, node.type)
}
