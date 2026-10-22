import { create } from 'zustand'
import {
  executeStep,
  FileChange,
  stopTerminals,
  TerminalUse,
  revertChanges,
  skipAnimation,
  resumeStep,
  StepError
} from '../engine/ExecutionEngine'
import { findNode, flattenSteps } from '../lib/tree'
import { joinPath } from '../lib/paths'
import { LessonNode } from '../types/schema'
import { LESSON_DIR, useLessonStore } from './useLessonStore'
import { reportError, SPECIAL_TAB_IDS, useIDEStore } from './useIDEStore'
import { StageSnapshot, useStageStore } from './useStageStore'
import { useFileSystemStore } from './useFileSystemStore'
import { useSettingsStore } from './useSettingsStore'
import { useTerminalStore } from './useTerminalStore'

interface HistoryEntry {
  stepId: string
  changes: FileChange[]
  /** Stage before the step ran, restored on undo. */
  stage: StageSnapshot
  /** Terminals the step used; undo stops what it left running there. */
  terminals?: TerminalUse[]
}

interface Chapter {
  title: string
  at: number
}

interface SessionFile {
  history: HistoryEntry[]
  sessionStartedAt: number | null
  chapters: Chapter[]
}

interface PlayerStore {
  /** Executed steps, in the order they ran. */
  history: HistoryEntry[]
  runningStepId: string | null
  /** When the first step of the session ran (for the timer and chapters). */
  sessionStartedAt: number | null
  stepStartedAt: number | null
  chapters: Chapter[]

  runStep: (id: string, options?: { instant?: boolean }) => Promise<boolean>
  runNext: () => Promise<void>
  undoLast: () => Promise<boolean>
  /** Runs (or undoes) steps until `id` is the last executed one. */
  goTo: (id: string) => Promise<void>
  resetAll: () => Promise<void>
  skip: () => void
  restartClock: () => void
  clear: () => void
  loadSession: (root: string) => Promise<void>
}

export const SESSION_FILE = 'sessao.json'
export const START_SNAPSHOT_DIR = 'inicio'

/** The step that "Next" would run. */
export function getNextStep(tree: LessonNode[], history: HistoryEntry[]): LessonNode | null {
  const steps = flattenSteps(tree)
  if (history.length === 0) return steps[0] ?? null
  const last = history[history.length - 1].stepId
  const index = steps.findIndex((s) => s.id === last)
  return index === -1 ? null : (steps[index + 1] ?? null)
}

/** Steps already executed; a step run again (double click) counts once. */
export function executedCount(history: HistoryEntry[]): number {
  return new Set(history.map((h) => h.stepId)).size
}

/** The step whose caption is on stage: the running one, or the last executed. */
export function getCurrentStep(
  tree: LessonNode[],
  history: HistoryEntry[],
  runningStepId: string | null
): LessonNode | null {
  const id = runningStepId ?? history[history.length - 1]?.stepId
  return id ? findNode(tree, id) : null
}

function closeStageTabs(stage: StageSnapshot): void {
  const ide = useIDEStore.getState()
  const remove: string[] = []
  if (!stage.slide) remove.push(SPECIAL_TAB_IDS.SLIDE)
  if (!stage.challenge) remove.push(SPECIAL_TAB_IDS.CHALLENGE)
  if (!stage.preview) remove.push(SPECIAL_TAB_IDS.PREVIEW)
  ide.closeNodeTabs(remove)
}

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  history: [],
  runningStepId: null,
  sessionStartedAt: null,
  stepStartedAt: null,
  chapters: [],

  runStep: async (id, options = {}) => {
    if (get().runningStepId) {
      useIDEStore
        .getState()
        .notify('Aguarde o passo atual terminar (Esc pula a animação).', 'warning')
      return false
    }
    const step = findNode(useLessonStore.getState().tree, id)
    if (!step || step.type !== 'STEP') return false

    const root = useFileSystemStore.getState().rootPath
    if (root && get().history.length === 0) {
      // First step of the session: keep a copy of the project for "Reset".
      try {
        if (!(await window.api.snapshotExists(root))) await window.api.snapshotCreate(root)
      } catch (e) {
        reportError(e, 'Não foi possível salvar o ponto de partida')
      }
    }

    const now = Date.now()
    set((state) => ({
      runningStepId: id,
      stepStartedAt: now,
      sessionStartedAt: state.sessionStartedAt ?? now,
      chapters: options.instant
        ? state.chapters
        : [...state.chapters, { title: step.title, at: now }]
    }))
    const { obs } = useSettingsStore.getState().settings
    if (!options.instant && obs.enabled && obs.chapters) window.api.obsChapter(step.title)
    useLessonStore.getState().selectNode(id)

    const stageBefore = useStageStore.getState().snapshot()
    const run = await executeStep(step, options)
    if (run.error) {
      // A failed step leaves the project as it was (terminal commands excepted).
      try {
        await revertChanges(run.changes)
        stopTerminals(run.terminals)
        useStageStore.getState().restore(stageBefore)
        closeStageTabs(stageBefore)
      } catch {
        // reported below with the original error
      }
    } else {
      set((state) => ({
        history: [
          ...state.history,
          { stepId: id, changes: run.changes, stage: stageBefore, terminals: run.terminals }
        ]
      }))
    }
    set({ runningStepId: null })

    if (run.error) {
      if (run.error instanceof StepError) {
        useIDEStore.getState().notify(`${step.title}: ${run.error.message}`, 'warning', 7000)
      } else {
        reportError(run.error, `Erro ao executar "${step.title}"`)
      }
      return false
    }
    return true
  },

  runNext: async () => {
    // A step waiting before its terminal command continues instead.
    if (resumeStep()) return
    const next = getNextStep(useLessonStore.getState().tree, get().history)
    if (!next) {
      useIDEStore.getState().notify('Todos os passos já foram executados.', 'info')
      return
    }
    await get().runStep(next.id)
  },

  undoLast: async () => {
    if (get().runningStepId) return false
    const last = get().history[get().history.length - 1]
    if (!last) return false
    try {
      await revertChanges(last.changes)
      stopTerminals(last.terminals ?? [])
      useStageStore.getState().restore(last.stage)
      closeStageTabs(last.stage)
      set((state) => ({ history: state.history.slice(0, -1) }))
      if (last.terminals?.length) {
        useIDEStore
          .getState()
          .notify(
            'O que o passo deixou rodando no terminal foi interrompido (Ctrl+C). Efeitos de comandos, como pacotes instalados, não são desfeitos.',
            'info',
            6000
          )
      }
      return true
    } catch (e) {
      reportError(e, 'Não foi possível voltar o passo')
      return false
    }
  },

  goTo: async (id) => {
    if (get().runningStepId) return
    const steps = flattenSteps(useLessonStore.getState().tree)
    const target = steps.findIndex((s) => s.id === id)
    if (target === -1) return

    const currentIndex = (): number => {
      const last = get().history[get().history.length - 1]
      return last ? steps.findIndex((s) => s.id === last.stepId) : -1
    }

    if (target <= currentIndex()) {
      while (currentIndex() > target) {
        if (!(await get().undoLast())) return
      }
      return
    }
    for (let i = currentIndex() + 1; i <= target; i++) {
      // Earlier steps run instantly; the target one is shown normally.
      if (!(await get().runStep(steps[i].id, { instant: i < target }))) return
    }
  },

  resetAll: async () => {
    if (get().runningStepId) return
    const root = useFileSystemStore.getState().rootPath
    const hasSnapshot = root ? await window.api.snapshotExists(root) : false
    if (get().history.length === 0 && !hasSnapshot) return

    const choice = await window.api.showMessage({
      type: 'question',
      message: 'Resetar a aula?',
      detail: hasSnapshot
        ? 'O projeto volta exatamente ao estado de antes do primeiro passo: arquivos criados durante a aula são apagados e os alterados são restaurados (node_modules e .git são preservados). Os terminais são reiniciados, então servidores iniciados na aula param.'
        : 'Os arquivos alterados pelos passos executados voltam ao estado original e os terminais são reiniciados.',
      buttons: ['Resetar', 'Cancelar'],
      defaultId: 0,
      cancelId: 1
    })
    if (choice !== 0) return

    if (root && hasSnapshot) {
      try {
        await window.api.snapshotRestore(root)
        await window.api.snapshotDelete(root)
        const fs = useFileSystemStore.getState()
        for (const path of Object.keys(fs.files)) {
          if (!(await fs.loadFile(path, true))) useIDEStore.getState().closeTabsUnder(path)
        }
        await useFileSystemStore.getState().refreshTree()
      } catch (e) {
        reportError(e, 'Não foi possível restaurar o ponto de partida')
        return
      }
    } else {
      while (get().history.length > 0) {
        if (!(await get().undoLast())) return
      }
    }
    useStageStore.getState().reset()
    closeStageTabs(useStageStore.getState().snapshot())
    // Fresh terminals: servers and other processes started by the lesson stop.
    useTerminalStore.getState().resetAll()
    set({ history: [], sessionStartedAt: null, stepStartedAt: null, chapters: [] })
    useIDEStore.getState().notify('Aula resetada.', 'success')
  },

  skip: () => skipAnimation(),

  restartClock: () => set({ sessionStartedAt: Date.now(), chapters: [] }),

  clear: () =>
    set({
      history: [],
      runningStepId: null,
      sessionStartedAt: null,
      stepStartedAt: null,
      chapters: []
    }),

  loadSession: async (root) => {
    loadingSession = true
    try {
      get().clear()
      const raw = await window.api.readFile(joinPath(root, LESSON_DIR, SESSION_FILE))
      if (!raw) return
      const session = JSON.parse(raw) as SessionFile
      set({
        history: Array.isArray(session.history) ? session.history : [],
        sessionStartedAt: session.sessionStartedAt ?? null,
        chapters: Array.isArray(session.chapters) ? session.chapters : []
      })
    } catch {
      // A corrupt session only loses the undo history.
    } finally {
      loadingSession = false
    }
  }
}))

/** YouTube-style chapter list ("00:00 Início"). */
export function chaptersText(): string {
  const { chapters, sessionStartedAt } = usePlayerStore.getState()
  if (!sessionStartedAt) return ''
  const format = (ms: number): string => {
    const total = Math.max(0, Math.floor(ms / 1000))
    const h = Math.floor(total / 3600)
    const m = Math.floor((total % 3600) / 60)
    const s = total % 60
    const mm = String(m).padStart(2, '0')
    const ss = String(s).padStart(2, '0')
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
  }
  const lines = ['00:00 Início']
  for (const chapter of chapters) {
    const offset = chapter.at - sessionStartedAt
    if (offset >= 1000) lines.push(`${format(offset)} ${chapter.title}`)
  }
  return lines.join('\n')
}

// --- Session persistence --------------------------------------------------------

let sessionTimer: ReturnType<typeof setTimeout> | null = null
let loadingSession = false

usePlayerStore.subscribe((state, prev) => {
  if (loadingSession) return
  if (state.history === prev.history && state.chapters === prev.chapters) return
  const root = useFileSystemStore.getState().rootPath
  if (!root) return
  // Captured now so a later workspace switch can't write this data elsewhere.
  const file: SessionFile = {
    history: state.history,
    sessionStartedAt: state.sessionStartedAt,
    chapters: state.chapters
  }
  if (sessionTimer) clearTimeout(sessionTimer)
  sessionTimer = setTimeout(async () => {
    const dir = joinPath(root, LESSON_DIR)
    try {
      await window.api.writeFile(joinPath(dir, SESSION_FILE), JSON.stringify(file) + '\n')
      // Session data and the start snapshot are machine-local: keep them out of git.
      const ignore = joinPath(dir, '.gitignore')
      if (!(await window.api.exists(ignore))) {
        await window.api.writeFile(ignore, `${SESSION_FILE}\n${START_SNAPSHOT_DIR}/\n`)
      }
    } catch (e) {
      reportError(e, 'Não foi possível salvar o progresso da aula')
    }
  }, 300)
})
