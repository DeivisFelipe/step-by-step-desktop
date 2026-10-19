import { create } from 'zustand'
import {
  executeStep,
  FileChange,
  revertChanges,
  skipAnimation,
  StepError
} from '../engine/ExecutionEngine'
import { findNode, flattenSteps } from '../lib/tree'
import { LessonNode } from '../types/schema'
import { useLessonStore } from './useLessonStore'
import { reportError, useIDEStore } from './useIDEStore'

interface HistoryEntry {
  stepId: string
  changes: FileChange[]
}

interface PlayerStore {
  /** Executed steps, in the order they ran. */
  history: HistoryEntry[]
  runningStepId: string | null

  runStep: (id: string) => Promise<void>
  runNext: () => Promise<void>
  undoLast: () => Promise<void>
  resetAll: () => Promise<void>
  skip: () => void
  clear: () => void
}

/** The step that "Next" would run. */
export function getNextStep(tree: LessonNode[], history: HistoryEntry[]): LessonNode | null {
  const steps = flattenSteps(tree)
  if (history.length === 0) return steps[0] ?? null
  const last = history[history.length - 1].stepId
  const index = steps.findIndex((s) => s.id === last)
  return index === -1 ? null : (steps[index + 1] ?? null)
}

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  history: [],
  runningStepId: null,

  runStep: async (id) => {
    if (get().runningStepId) {
      useIDEStore
        .getState()
        .notify('Aguarde o passo atual terminar (Esc pula a animação).', 'warning')
      return
    }
    const step = findNode(useLessonStore.getState().tree, id)
    if (!step || step.type !== 'STEP') return

    set({ runningStepId: id })
    useLessonStore.getState().selectNode(id)
    try {
      const changes = await executeStep(step)
      set((state) => ({ history: [...state.history, { stepId: id, changes }] }))
    } catch (e) {
      if (e instanceof StepError)
        useIDEStore.getState().notify(`${step.title}: ${e.message}`, 'warning', 6000)
      else reportError(e, `Erro ao executar "${step.title}"`)
    } finally {
      set({ runningStepId: null })
    }
  },

  runNext: async () => {
    const next = getNextStep(useLessonStore.getState().tree, get().history)
    if (!next) {
      useIDEStore.getState().notify('Todos os passos já foram executados.', 'info')
      return
    }
    await get().runStep(next.id)
  },

  undoLast: async () => {
    if (get().runningStepId) return
    const last = get().history[get().history.length - 1]
    if (!last) return
    try {
      await revertChanges(last.changes)
      set((state) => ({ history: state.history.slice(0, -1) }))
      const step = findNode(useLessonStore.getState().tree, last.stepId)
      if (step?.data?.action.kind === 'TERMINAL') {
        useIDEStore.getState().notify('Comandos de terminal não podem ser desfeitos.', 'info')
      }
    } catch (e) {
      reportError(e, 'Não foi possível voltar o passo')
    }
  },

  resetAll: async () => {
    if (get().runningStepId || get().history.length === 0) return
    const choice = await window.api.showMessage({
      type: 'question',
      message: 'Resetar a aula?',
      detail: 'Os arquivos alterados pelos passos executados voltam ao estado original.',
      buttons: ['Resetar', 'Cancelar'],
      defaultId: 0,
      cancelId: 1
    })
    if (choice !== 0) return
    while (get().history.length > 0) {
      const before = get().history.length
      await get().undoLast()
      if (get().history.length === before) break
    }
  },

  skip: () => skipAnimation(),

  clear: () => set({ history: [], runningStepId: null })
}))
