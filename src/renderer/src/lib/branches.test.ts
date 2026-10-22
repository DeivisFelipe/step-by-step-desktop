import { beforeEach, describe, expect, it } from 'vitest'
import { LessonNode } from '../types/schema'
import { useLessonStore } from '../store/useLessonStore'
import { branchesOf, isBranchHandle, setBranchTarget, setJump } from './branches'
import { findNode } from './tree'

function lesson(): LessonNode[] {
  return [
    {
      id: 'f',
      parentId: null,
      type: 'FLOW',
      title: 'Fluxo',
      children: [
        {
          id: 'menu',
          parentId: 'f',
          type: 'STEP',
          title: 'Menu',
          data: {
            actions: [
              {
                id: 'c',
                kind: 'CHOICE',
                title: 'Para onde?',
                showOnStage: true,
                options: [
                  { id: 'o1', label: 'Esquerda' },
                  { id: 'o2', label: 'Direita', target: 'b' }
                ]
              },
              {
                id: 'k',
                kind: 'CONDITION',
                rules: [{ id: 'r1', test: { type: 'file-exists', path: 'a.txt' } }]
              }
            ]
          }
        },
        { id: 'a', parentId: 'f', type: 'STEP', title: 'A', data: { actions: [] } },
        { id: 'b', parentId: 'f', type: 'STEP', title: 'B', data: { actions: [] } }
      ]
    }
  ]
}

const step = (id: string): LessonNode => findNode(useLessonStore.getState().tree, id)!

describe('branches', () => {
  beforeEach(() => useLessonStore.setState({ tree: lesson() }))

  it('lists menu options, rules and the else as handles', () => {
    const branches = branchesOf(step('menu'))
    expect(branches.map((b) => b.label)).toEqual([
      '1. Esquerda',
      '2. Direita',
      'se existe a.txt',
      'senão'
    ])
    expect(branches.every((b) => isBranchHandle(b.handle))).toBe(true)
    expect(branches[1].target).toBe('b')
    expect(isBranchHandle('r')).toBe(false)
  })

  it('points a menu option at a step and clears it', () => {
    const [left] = branchesOf(step('menu'))
    setBranchTarget('menu', left.handle, 'a')
    expect(branchesOf(step('menu'))[0].target).toBe('a')
    setBranchTarget('menu', left.handle, undefined)
    expect(branchesOf(step('menu'))[0].target).toBeUndefined()
  })

  it('sets rule and else targets', () => {
    const [, , rule, otherwise] = branchesOf(step('menu'))
    setBranchTarget('menu', rule.handle, 'b')
    setBranchTarget('menu', otherwise.handle, 'a')
    const after = branchesOf(step('menu'))
    expect(after[2].target).toBe('b')
    expect(after[3].target).toBe('a')
  })

  it('creates a go to from the bottom handle, then reuses it', () => {
    setJump('a', 'menu')
    expect(branchesOf(step('a'))).toMatchObject([{ kind: 'GOTO', target: 'menu' }])
    setJump('a', 'b')
    expect(step('a').data!.actions.filter((x) => x.kind === 'GOTO')).toHaveLength(1)
    expect(branchesOf(step('a'))[0].target).toBe('b')
  })
})
