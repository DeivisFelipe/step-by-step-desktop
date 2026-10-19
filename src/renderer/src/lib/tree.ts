import { ActionKind, LessonNode, StepAction } from '../types/schema'

export function findNode(nodes: LessonNode[], id: string): LessonNode | null {
  for (const node of nodes) {
    if (node.id === id) return node
    if (node.children) {
      const found = findNode(node.children, id)
      if (found) return found
    }
  }
  return null
}

/** All STEP nodes in presentation order (depth first). */
export function flattenSteps(nodes: LessonNode[]): LessonNode[] {
  const result: LessonNode[] = []
  const walk = (list: LessonNode[]): void => {
    for (const node of list) {
      if (node.type === 'STEP') result.push(node)
      if (node.children) walk(node.children)
    }
  }
  walk(nodes)
  return result
}

/** Ids of a node and all of its descendants. */
export function collectIds(node: LessonNode): string[] {
  return [node.id, ...(node.children ?? []).flatMap(collectIds)]
}

/** Returns a copy of the tree with `fn` applied to the node with `id`. */
export function mapNode(
  nodes: LessonNode[],
  id: string,
  fn: (node: LessonNode) => LessonNode
): LessonNode[] {
  return nodes.map((node) => {
    if (node.id === id) return fn(node)
    if (node.children) return { ...node, children: mapNode(node.children, id, fn) }
    return node
  })
}

/** Removes a node, returning the new tree and the removed node. */
export function removeNode(
  nodes: LessonNode[],
  id: string
): { tree: LessonNode[]; removed: LessonNode | null } {
  let removed: LessonNode | null = null
  const walk = (list: LessonNode[]): LessonNode[] =>
    list
      .filter((node) => {
        if (node.id === id) {
          removed = node
          return false
        }
        return true
      })
      .map((node) => (node.children ? { ...node, children: walk(node.children) } : node))
  const tree = walk(nodes)
  return { tree, removed }
}

/** Inserts `node` into `parentId`'s children (or the root list) at `index`. */
export function insertNode(
  nodes: LessonNode[],
  parentId: string | null,
  index: number,
  node: LessonNode
): LessonNode[] {
  const placed = { ...node, parentId }
  if (parentId === null) {
    const copy = [...nodes]
    copy.splice(clamp(index, 0, copy.length), 0, placed)
    return copy
  }
  return mapNode(nodes, parentId, (parent) => {
    const children = [...(parent.children ?? [])]
    children.splice(clamp(index, 0, children.length), 0, placed)
    return { ...parent, children, isExpanded: true }
  })
}

export function siblingsOf(nodes: LessonNode[], parentId: string | null): LessonNode[] {
  if (parentId === null) return nodes
  return findNode(nodes, parentId)?.children ?? []
}

/** The flow a node belongs to (itself when it is a flow). */
export function flowOf(nodes: LessonNode[], node: LessonNode): LessonNode | null {
  let current: LessonNode | null = node
  while (current && current.type !== 'FLOW') {
    current = current.parentId ? findNode(nodes, current.parentId) : null
  }
  return current
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function newId(): string {
  return crypto.randomUUID()
}

/** Deep copy with fresh ids (used by "duplicate"). */
export function cloneWithNewIds(node: LessonNode, parentId: string | null): LessonNode {
  const id = newId()
  const copy = structuredClone(node)
  return {
    ...copy,
    id,
    parentId,
    data: copy.data
      ? { ...copy.data, actions: copy.data.actions.map((a) => ({ ...a, id: newId() })) }
      : undefined,
    children: node.children?.map((child) => cloneWithNewIds(child, id))
  }
}

export function defaultAction(kind: ActionKind, id: string = newId()): StepAction {
  switch (kind) {
    case 'TERMINAL':
      return { id, kind, command: '', executeImmediately: true, typingAnimation: true }
    case 'WAIT':
      return { id, kind, pattern: '', timeoutSec: 60 }
    case 'SLIDE':
      return { id, kind, markdown: '# Título\n\nTexto do slide' }
    case 'HIGHLIGHT':
      return { id, kind, targetMode: 'ACTIVE_FILE', startLine: 1, endLine: 1, note: '' }
    case 'CHALLENGE':
      return {
        id,
        kind,
        markdown: '## Desafio\n\nDescreva o que a turma deve fazer.',
        durationSec: 300
      }
    case 'PREVIEW':
      return { id, kind, url: 'index.html' }
    case 'OBS_SCENE':
      return { id, kind, scene: '' }
    case 'FILE':
    default:
      return {
        id,
        kind: 'FILE',
        targetMode: 'ACTIVE_FILE',
        operation: 'APPEND',
        content: '',
        config: { animation: 'TYPING', typingSpeedMs: 30 }
      }
  }
}

export const ACTION_LABELS: Record<ActionKind, string> = {
  FILE: 'Código em arquivo',
  TERMINAL: 'Comando no terminal',
  WAIT: 'Esperar o terminal',
  SLIDE: 'Slide',
  HIGHLIGHT: 'Destacar linhas',
  CHALLENGE: 'Desafio',
  PREVIEW: 'Preview',
  OBS_SCENE: 'Cena do OBS'
}

/** Kind of the main action of a step (used for icons). */
export function primaryKind(node: LessonNode): ActionKind {
  return node.data?.actions[0]?.kind ?? 'FILE'
}

/**
 * Upgrades lessons saved by older versions (one `action` per step,
 * `typingAnimation` boolean) to the current format. Mutates nothing.
 */
export function migrateTree(nodes: unknown[]): LessonNode[] {
  return (nodes as LessonNode[]).map((raw) => {
    const node = { ...raw }
    if (node.children) node.children = migrateTree(node.children)
    if (node.type === 'STEP') {
      const data = { ...(node.data ?? {}) } as StepData & { action?: Record<string, unknown> }
      let actions = (data.actions ?? (data.action ? [data.action] : [])) as unknown as Record<
        string,
        unknown
      >[]
      actions = actions.map((a) => {
        const action: Record<string, unknown> = { ...a, id: (a.id as string) || newId() }
        if (action.kind === 'FILE') {
          const config = { ...((action.config as Record<string, unknown>) ?? {}) }
          if (!config.animation) {
            config.animation = config.typingAnimation === false ? 'NONE' : 'TYPING'
          }
          delete config.typingAnimation
          action.config = config
        }
        return action
      })
      delete data.action
      node.data = { ...data, actions: actions as unknown as StepAction[] }
    }
    return node
  })
}

type StepData = NonNullable<LessonNode['data']>

/** `[[Name:value]]` placeholders let the presenter tweak values before running a step. */
export const PLACEHOLDER_REGEX = /\[\[([^:\]]+):([^\]]*)\]\]/g

export function resolvePlaceholders(text: string): string {
  return text.replace(PLACEHOLDER_REGEX, (_match, _key, value: string) => value)
}

export interface Placeholder {
  key: string
  value: string
  index: number
  raw: string
}

export function findPlaceholders(text: string): Placeholder[] {
  return [...text.matchAll(PLACEHOLDER_REGEX)].map((m) => ({
    key: m[1],
    value: m[2],
    index: m.index ?? 0,
    raw: m[0]
  }))
}
