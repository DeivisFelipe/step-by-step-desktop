import { create } from 'zustand'
import { ActionKind, LessonFile, LessonNode, NodeType, StepAction, StepData } from '../types/schema'
import {
  cloneWithNewIds,
  collectIds,
  defaultAction,
  findNode,
  insertNode,
  mapNode,
  migrateTree,
  newId,
  removeNode,
  siblingsOf
} from '../lib/tree'
import { joinPath } from '../lib/paths'
import { reportError, useIDEStore } from './useIDEStore'

export const LESSON_DIR = '.stepbystep'
export const LESSON_FILE = 'lesson.json'

export function lessonFilePath(root: string): string {
  return joinPath(root, LESSON_DIR, LESSON_FILE)
}

function initialTree(): LessonNode[] {
  return [
    { id: newId(), parentId: null, type: 'FLOW', title: 'Aula 1', isExpanded: true, children: [] }
  ]
}

interface LessonStore {
  title: string
  tree: LessonNode[]
  selectedNodeId: string | null
  /** Workspace whose lesson file is loaded; changes are auto-saved there. */
  workspace: string | null
  saveState: 'saved' | 'saving' | 'error'

  loadForWorkspace: (root: string) => Promise<void>
  selectNode: (id: string | null) => void

  /**
   * Adds a node next to the given reference: inside it when it is a flow,
   * after it when it is a step. Returns the new node id.
   */
  addNode: (type: NodeType, referenceId: string | null, title?: string) => string
  updateNode: (id: string, updates: Partial<Pick<LessonNode, 'title' | 'isExpanded'>>) => void
  updateStepData: (id: string, data: Partial<StepData>) => void
  setTitle: (title: string) => void
  /** Replaces the whole lesson (imports). */
  replaceTree: (tree: LessonNode[], title?: string) => void
  /** Appends flows at the end of the lesson (imports). */
  appendNodes: (nodes: LessonNode[]) => void

  addAction: (stepId: string, kind: ActionKind, index?: number) => string
  updateAction: (stepId: string, actionId: string, partial: Partial<StepAction>) => void
  setActionKind: (stepId: string, actionId: string, kind: ActionKind) => void
  removeAction: (stepId: string, actionId: string) => void
  moveAction: (stepId: string, actionId: string, direction: 'up' | 'down') => void
  removeNode: (id: string) => void
  duplicateNode: (id: string) => void

  /** Drag & drop in the outline: puts `activeId` where `overId` is. */
  moveNode: (activeId: string, overId: string) => void
  reorderNode: (id: string, direction: 'up' | 'down') => void
  /** Flow editor connections: `id` goes right after `referenceId`. */
  placeAfter: (id: string, referenceId: string) => void
  placeFirst: (id: string, parentId: string) => void
}

function mapActions(
  tree: LessonNode[],
  stepId: string,
  fn: (actions: StepAction[]) => StepAction[]
): LessonNode[] {
  return mapNode(tree, stepId, (node) =>
    node.data ? { ...node, data: { ...node.data, actions: fn(node.data.actions) } } : node
  )
}

export const useLessonStore = create<LessonStore>((set, get) => ({
  title: '',
  tree: initialTree(),
  selectedNodeId: null,
  workspace: null,
  saveState: 'saved',

  loadForWorkspace: async (root) => {
    await flushLessonSave()
    let tree: LessonNode[] | null = null
    let title = ''
    const raw = await window.api.readFile(lessonFilePath(root))
    if (raw !== null) {
      try {
        const parsed = JSON.parse(raw) as LessonFile
        if (Array.isArray(parsed.tree)) tree = migrateTree(parsed.tree)
        title = parsed.title ?? ''
      } catch (e) {
        reportError(e, 'Arquivo da aula inválido')
      }
    }
    set({
      tree: tree ?? initialTree(),
      title,
      selectedNodeId: null,
      workspace: root,
      saveState: 'saved'
    })
  },

  selectNode: (id) => set({ selectedNodeId: id }),

  addNode: (type, referenceId, title) => {
    const node: LessonNode = {
      id: newId(),
      parentId: null,
      type,
      title: title || (type === 'FLOW' ? 'Novo fluxo' : 'Novo passo'),
      isExpanded: true,
      children: type === 'FLOW' ? [] : undefined,
      data: type === 'STEP' ? { actions: [defaultAction('FILE')] } : undefined
    }

    const { tree } = get()
    const reference = referenceId ? findNode(tree, referenceId) : null
    let parentId: string | null = null
    let index = tree.length

    if (type === 'FLOW') {
      // Flows only live at the root, after the reference's top-level ancestor.
      let top = reference
      while (top?.parentId) top = findNode(tree, top.parentId)
      if (top) index = tree.findIndex((n) => n.id === top!.id) + 1
    } else if (reference?.type === 'FLOW') {
      parentId = reference.id
      index = reference.children?.length ?? 0
    } else if (reference) {
      parentId = reference.parentId
      index = siblingsOf(tree, parentId).findIndex((n) => n.id === reference.id) + 1
    }

    set({ tree: insertNode(tree, parentId, index, node), selectedNodeId: node.id })
    return node.id
  },

  updateNode: (id, updates) => {
    set((state) => ({ tree: mapNode(state.tree, id, (node) => ({ ...node, ...updates })) }))
  },

  updateStepData: (id, data) => {
    set((state) => ({
      tree: mapNode(state.tree, id, (node) =>
        node.data ? { ...node, data: { ...node.data, ...data } } : node
      )
    }))
  },

  setTitle: (title) => set({ title }),

  replaceTree: (tree, title) =>
    set((state) => ({ tree, title: title ?? state.title, selectedNodeId: null })),

  appendNodes: (nodes) =>
    set((state) => ({ tree: [...state.tree, ...nodes.map((n) => ({ ...n, parentId: null }))] })),

  addAction: (stepId, kind, index) => {
    const action = defaultAction(kind)
    set((state) => ({
      tree: mapActions(state.tree, stepId, (actions) => {
        const copy = [...actions]
        copy.splice(index ?? copy.length, 0, action)
        return copy
      })
    }))
    return action.id
  },

  updateAction: (stepId, actionId, partial) => {
    set((state) => ({
      tree: mapActions(state.tree, stepId, (actions) =>
        actions.map((a) => (a.id === actionId ? ({ ...a, ...partial } as StepAction) : a))
      )
    }))
  },

  setActionKind: (stepId, actionId, kind) => {
    set((state) => ({
      tree: mapActions(state.tree, stepId, (actions) =>
        actions.map((a) => (a.id === actionId && a.kind !== kind ? defaultAction(kind, a.id) : a))
      )
    }))
  },

  removeAction: (stepId, actionId) => {
    set((state) => ({
      tree: mapActions(state.tree, stepId, (actions) => actions.filter((a) => a.id !== actionId))
    }))
  },

  moveAction: (stepId, actionId, direction) => {
    set((state) => ({
      tree: mapActions(state.tree, stepId, (actions) => {
        const index = actions.findIndex((a) => a.id === actionId)
        const target = direction === 'up' ? index - 1 : index + 1
        if (index < 0 || target < 0 || target >= actions.length) return actions
        const copy = [...actions]
        ;[copy[index], copy[target]] = [copy[target], copy[index]]
        return copy
      })
    }))
  },

  removeNode: (id) => {
    const target = findNode(get().tree, id)
    if (!target) return
    const ids = collectIds(target)
    set((state) => ({
      tree: removeNode(state.tree, id).tree,
      selectedNodeId:
        state.selectedNodeId && ids.includes(state.selectedNodeId) ? null : state.selectedNodeId
    }))
    useIDEStore.getState().closeNodeTabs(ids)
  },

  duplicateNode: (id) => {
    const { tree } = get()
    const node = findNode(tree, id)
    if (!node) return
    const copy = cloneWithNewIds(node, node.parentId)
    copy.title = `${node.title} (cópia)`
    const index = siblingsOf(tree, node.parentId).findIndex((n) => n.id === id) + 1
    set({ tree: insertNode(tree, node.parentId, index, copy), selectedNodeId: copy.id })
  },

  moveNode: (activeId, overId) => {
    const { tree } = get()
    const active = findNode(tree, activeId)
    let over = findNode(tree, overId)
    if (!active || !over || activeId === overId) return

    if (active.type === 'FLOW') {
      // Flows are reordered among the top-level nodes only.
      while (over.parentId) over = findNode(tree, over.parentId)!
      if (over.id === activeId) return
    }

    const oldSiblings = siblingsOf(tree, active.parentId)
    const oldIndex = oldSiblings.findIndex((n) => n.id === activeId)
    const { tree: without } = removeNode(tree, activeId)

    // Dropping a step on a flow header moves it to the start of that flow.
    if (active.type === 'STEP' && over.type === 'FLOW' && over.id !== active.parentId) {
      set({ tree: insertNode(without, over.id, 0, active) })
      return
    }

    const targetParent = active.type === 'FLOW' ? null : over.parentId
    const overIndex = siblingsOf(without, targetParent).findIndex((n) => n.id === over!.id)
    const overOldIndex = siblingsOf(tree, targetParent).findIndex((n) => n.id === over!.id)
    // Same list and moving down: land after the target, like arrayMove.
    const after = targetParent === active.parentId && oldIndex < overOldIndex
    set({ tree: insertNode(without, targetParent, overIndex + (after ? 1 : 0), active) })
  },

  reorderNode: (id, direction) => {
    const { tree } = get()
    const node = findNode(tree, id)
    if (!node) return
    const siblings = siblingsOf(tree, node.parentId)
    const index = siblings.findIndex((n) => n.id === id)
    const target = direction === 'up' ? index - 1 : index + 1
    if (target < 0 || target >= siblings.length) return
    const { tree: without } = removeNode(tree, id)
    set({ tree: insertNode(without, node.parentId, target, node) })
  },

  placeAfter: (id, referenceId) => {
    const { tree } = get()
    const node = findNode(tree, id)
    const reference = findNode(tree, referenceId)
    if (!node || !reference || id === referenceId) return
    const { tree: without } = removeNode(tree, id)
    const index = siblingsOf(without, reference.parentId).findIndex((n) => n.id === referenceId)
    set({ tree: insertNode(without, reference.parentId, index + 1, node) })
  },

  placeFirst: (id, parentId) => {
    const { tree } = get()
    const node = findNode(tree, id)
    if (!node) return
    const { tree: without } = removeNode(tree, id)
    set({ tree: insertNode(without, parentId, 0, node) })
  }
}))

// --- Auto-save -------------------------------------------------------------

let saveTimer: ReturnType<typeof setTimeout> | null = null

async function saveLesson(): Promise<void> {
  const { workspace, tree, title } = useLessonStore.getState()
  if (!workspace) return
  const file: LessonFile = { version: 2, title: title || undefined, tree }
  try {
    await window.api.writeFile(lessonFilePath(workspace), JSON.stringify(file, null, 2) + '\n')
    if (useLessonStore.getState().tree === tree) useLessonStore.setState({ saveState: 'saved' })
  } catch (e) {
    useLessonStore.setState({ saveState: 'error' })
    reportError(e, 'Não foi possível salvar a aula')
  }
}

/** Writes any pending change right away (before switching workspaces or closing). */
export async function flushLessonSave(): Promise<void> {
  if (!saveTimer) return
  clearTimeout(saveTimer)
  saveTimer = null
  await saveLesson()
}

useLessonStore.subscribe((state, prev) => {
  const changed = state.tree !== prev.tree || state.title !== prev.title
  if (!changed || !state.workspace || state.workspace !== prev.workspace) return
  useLessonStore.setState({ saveState: 'saving' })
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(saveLesson, 400)
})
