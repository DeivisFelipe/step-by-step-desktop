import { describe, expect, it } from 'vitest'
import { LessonNode, StepAction } from '../types/schema'
import {
  ACTION_LABELS,
  cloneWithNewIds,
  defaultAction,
  findPlaceholders,
  flattenSteps,
  migrateTree,
  nextStepOf,
  resolvePlaceholders
} from './tree'

function step(id: string, actions: StepAction[] = []): LessonNode {
  return { id, parentId: 'f', type: 'STEP', title: `Passo ${id}`, data: { actions } }
}

const tree: LessonNode[] = [
  {
    id: 'f',
    parentId: null,
    type: 'FLOW',
    title: 'Fluxo',
    children: [step('a'), step('b'), step('c'), step('d')]
  }
]

describe('nextStepOf', () => {
  it('starts at the first step', () => {
    expect(nextStepOf(tree, [])?.id).toBe('a')
  })

  it('follows the list after the last executed step', () => {
    expect(nextStepOf(tree, [{ stepId: 'a' }])?.id).toBe('b')
    expect(nextStepOf(tree, [{ stepId: 'a' }, { stepId: 'b' }])?.id).toBe('c')
  })

  it('ends after the last step', () => {
    expect(nextStepOf(tree, [{ stepId: 'd' }])).toBeNull()
  })

  it('follows the path chosen by the last step', () => {
    expect(nextStepOf(tree, [{ stepId: 'a', next: 'd' }])?.id).toBe('d')
    // a path that points backwards (loop)
    expect(nextStepOf(tree, [{ stepId: 'd', next: 'b' }])?.id).toBe('b')
  })

  it('falls back to the list when the chosen step was deleted', () => {
    expect(nextStepOf(tree, [{ stepId: 'a', next: 'gone' }])?.id).toBe('b')
  })

  it('only looks at the last executed step', () => {
    expect(nextStepOf(tree, [{ stepId: 'a', next: 'd' }, { stepId: 'b' }])?.id).toBe('c')
  })
})

describe('defaultAction', () => {
  it('creates every kind with its label', () => {
    for (const kind of Object.keys(ACTION_LABELS) as StepAction['kind'][]) {
      const action = defaultAction(kind, 'x')
      expect(action.kind).toBe(kind)
      expect(action.id).toBe('x')
    }
  })

  it('gives menus two options with distinct ids', () => {
    const action = defaultAction('CHOICE')
    if (action.kind !== 'CHOICE') throw new Error('kind')
    expect(action.options).toHaveLength(2)
    expect(action.options[0].id).not.toBe(action.options[1].id)
    expect(action.showOnStage).toBe(true)
  })
})

describe('cloneWithNewIds', () => {
  it('gives the copy and its actions new ids', () => {
    const original = step('s', [defaultAction('TERMINAL', 'a1')])
    const copy = cloneWithNewIds(original, 'f')
    expect(copy.id).not.toBe('s')
    expect(copy.data!.actions[0].id).not.toBe('a1')
    expect(copy.data!.actions[0].kind).toBe('TERMINAL')
  })
})

describe('migrateTree', () => {
  it('upgrades the old single action format', () => {
    const old = [
      {
        id: 's',
        parentId: null,
        type: 'STEP',
        title: 'Antigo',
        data: { action: { kind: 'FILE', config: { typingAnimation: false } } }
      }
    ]
    const [migrated] = migrateTree(old)
    expect(migrated.data!.actions).toHaveLength(1)
    const action = migrated.data!.actions[0]
    if (action.kind !== 'FILE') throw new Error('kind')
    expect(action.config.animation).toBe('NONE')
    expect(action.id).toBeTruthy()
  })
})

describe('placeholders', () => {
  it('replaces [[name:value]] with the value', () => {
    expect(resolvePlaceholders('porta [[porta:8000]] ok')).toBe('porta 8000 ok')
    expect(findPlaceholders('a [[x:1]] b [[y:2]]').map((p) => p.key)).toEqual(['x', 'y'])
  })
})

describe('flattenSteps', () => {
  it('lists steps in order across flows', () => {
    const two: LessonNode[] = [
      ...tree,
      { id: 'g', parentId: null, type: 'FLOW', title: 'Outro', children: [step('e')] }
    ]
    expect(flattenSteps(two).map((s) => s.id)).toEqual(['a', 'b', 'c', 'd', 'e'])
  })
})
