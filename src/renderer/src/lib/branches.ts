import { ConditionTest, LessonNode, StepAction } from '../types/schema'
import { useLessonStore } from '../store/useLessonStore'

// Paths of a step (menu options, if/else rules, go to) as the flow diagram shows them:
// each one is a handle on the step's card, linked to the step it leads to.

export interface BranchOut {
  /** React Flow handle id: "b|<actionId>|<key>". */
  handle: string
  kind: 'CHOICE' | 'CONDITION' | 'GOTO'
  label: string
  /** Step id; empty = the next step of the list. */
  target?: string
}

const SEP = '|'

function handleId(actionId: string, key: string): string {
  return ['b', actionId, key].join(SEP)
}

export function isBranchHandle(handle: string | null | undefined): handle is string {
  return !!handle && handle.startsWith('b' + SEP)
}

function shortTest(test: ConditionTest): string {
  switch (test.type) {
    case 'output-contains':
      return `saída tem “${test.text}”`
    case 'file-exists':
      return `existe ${test.path}`
    case 'file-contains':
      return `${test.path} tem “${test.text}”`
    case 'variable-equals':
      return `${test.name} = ${test.value}`
  }
}

/** The ways out of a step, in the order they are tested. */
export function branchesOf(step: LessonNode): BranchOut[] {
  const out: BranchOut[] = []
  for (const action of step.data?.actions ?? []) {
    if (action.kind === 'CHOICE') {
      action.options.forEach((option, i) =>
        out.push({
          handle: handleId(action.id, option.id),
          kind: 'CHOICE',
          label: `${i + 1}. ${option.label}`,
          target: option.target
        })
      )
    } else if (action.kind === 'CONDITION') {
      action.rules.forEach((rule, i) =>
        out.push({
          handle: handleId(action.id, rule.id),
          kind: 'CONDITION',
          label: `${i === 0 ? 'se' : 'senão se'} ${shortTest(rule.test)}`,
          target: rule.target
        })
      )
      out.push({
        handle: handleId(action.id, 'otherwise'),
        kind: 'CONDITION',
        label: 'senão',
        target: action.otherwise
      })
    } else if (action.kind === 'GOTO') {
      out.push({
        handle: handleId(action.id, 'goto'),
        kind: 'GOTO',
        label: 'ir para',
        target: action.target
      })
    }
  }
  return out
}

/** Points the path `handle` of `stepId` at `target` (undefined = next of the list). */
export function setBranchTarget(stepId: string, handle: string, target: string | undefined): void {
  const [, actionId, key] = handle.split(SEP)
  const lesson = useLessonStore.getState()
  const step = findStep(lesson.tree, stepId)
  const action = step?.data?.actions.find((a) => a.id === actionId)
  if (!action) return
  let partial: Partial<StepAction> | null = null
  if (action.kind === 'CHOICE') {
    partial = {
      options: action.options.map((o) => (o.id === key ? { ...o, target } : o))
    }
  } else if (action.kind === 'CONDITION') {
    partial =
      key === 'otherwise'
        ? { otherwise: target }
        : { rules: action.rules.map((r) => (r.id === key ? { ...r, target } : r)) }
  } else if (action.kind === 'GOTO') {
    partial = { target }
  }
  if (partial) lesson.updateAction(stepId, actionId, partial)
}

/** "Go to" from the card's bottom handle: reuses the step's go to, or adds one. */
export function setJump(stepId: string, target: string): void {
  const lesson = useLessonStore.getState()
  const step = findStep(lesson.tree, stepId)
  const goto = step?.data?.actions.find((a) => a.kind === 'GOTO')
  const id = goto?.id ?? lesson.addAction(stepId, 'GOTO')
  lesson.updateAction(stepId, id, { target })
}

function findStep(nodes: LessonNode[], id: string): LessonNode | null {
  for (const node of nodes) {
    if (node.id === id) return node
    const found = node.children ? findStep(node.children, id) : null
    if (found) return found
  }
  return null
}
