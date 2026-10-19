import { ActionType, LessonNode } from '../types/schema'

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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function newId(): string {
  return crypto.randomUUID()
}

/** Deep copy with fresh ids (used by "duplicate"). */
export function cloneWithNewIds(node: LessonNode, parentId: string | null): LessonNode {
  const id = newId()
  return {
    ...structuredClone(node),
    id,
    parentId,
    children: node.children?.map((child) => cloneWithNewIds(child, id))
  }
}

export function defaultAction(kind: ActionType['kind']): ActionType {
  if (kind === 'TERMINAL') {
    return { kind: 'TERMINAL', command: '', executeImmediately: true, typingAnimation: true }
  }
  return {
    kind: 'FILE',
    targetMode: 'ACTIVE_FILE',
    operation: 'APPEND',
    content: '',
    config: { typingAnimation: true, typingSpeedMs: 30 }
  }
}

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
