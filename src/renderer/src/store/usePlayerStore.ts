import { create } from 'zustand'
import {
  executeStep,
  FileChange,
  stopTerminals,
  TerminalUse,
  revertChanges,
  skipAnimation,
  resumeStep,
  chooseOption,
  cancelWaiting,
  usePauseStore,
  terminalFor,
  StepError
} from '../engine/ExecutionEngine'
import { findNode, flattenSteps, nextStepOf } from '../lib/tree'
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
  /** Step chosen by a menu, condition or "go to"; absent = the next one of the list. */
  next?: string
  /** Lesson variables before the step, restored on undo. */
  variables?: Record<string, string>
}

interface Chapter {
  title: string
  at: number
}

interface SessionFile {
  history: HistoryEntry[]
  variables?: Record<string, string>
  sessionStartedAt: number | null
  chapters: Chapter[]
}

interface PlayerStore {
  /** Executed steps, in the order they ran. */
  history: HistoryEntry[]
  /** Values saved by menus (used by "Se / senão" conditions). */
  variables: Record<string, string>
  runningStepId: string | null
  /** When the first step of the session ran (for the timer and chapters). */
  sessionStartedAt: number | null
  stepStartedAt: number | null
  chapters: Chapter[]

  runStep: (id: string, options?: { instant?: boolean }) => Promise<boolean>
  runNext: () => Promise<void>
  /**
   * Picks a menu option (index or label). With no menu waiting, runs the step with
   * that number or title (proximoPasso() in HTML slides).
   */
  choose: (value: number | string) => Promise<void>
  /** Runs a command in a terminal (play buttons of HTML slides). */
  runCommand: (command: string, terminal?: string) => Promise<void>
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
  return nextStepOf(tree, history)
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
  variables: {},
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
    const variablesBefore = get().variables
    const run = await executeStep(step, { ...options, variables: variablesBefore })
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
        variables: run.variables,
        history: [
          ...state.history,
          {
            stepId: id,
            changes: run.changes,
            stage: stageBefore,
            terminals: run.terminals,
            next: run.next,
            variables: variablesBefore
          }
        ]
      }))
    }
    set({ runningStepId: null })
    // A menu option was picked: its step runs right away.
    if (!run.error && run.advance) setTimeout(() => get().runNext(), 0)

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

  choose: async (value) => {
    const pause = usePauseStore.getState()
    if (pause.kind === 'choice' && pause.choice) {
      const index =
        typeof value === 'number'
          ? value
          : pause.choice.options.findIndex(
              (o) => o.trim().toLowerCase() === value.trim().toLowerCase()
            )
      if (!chooseOption(index)) {
        useIDEStore.getState().notify(`O menu não tem a opção "${value}".`, 'warning')
      }
      return
    }
    if (get().runningStepId) return
    // No menu waiting: go to the step with that number (as in "Passo 3") or title.
    const steps = flattenSteps(useLessonStore.getState().tree)
    const step =
      typeof value === 'number'
        ? steps[value - 1]
        : steps.find((s) => s.title.trim().toLowerCase() === value.trim().toLowerCase())
    if (!step) {
      useIDEStore.getState().notify(`Passo "${value}" não encontrado.`, 'warning')
      return
    }
    await get().runStep(step.id)
  },

  runCommand: async (command, terminal) => {
    const uses: TerminalUse[] = []
    try {
      const { key, id } = await terminalFor(terminal, (use) => uses.push(use))
      const stage = useStageStore.getState()
      stage.setTerminal(key)
      if (stage.view !== 'lab') stage.setView('terminal', true)
      else stage.setLabTab('terminal')
      window.api.sendTerminalInput(id, command.replace(/\r?\n/g, '\r') + '\r')
    } catch (e) {
      reportError(e, 'Não foi possível rodar o comando')
      return
    }
    // Undo of the current step also stops what the button started.
    set((state) => {
      const last = state.history[state.history.length - 1]
      if (!last) return {}
      const terminals = [...(last.terminals ?? [])]
      for (const use of uses) if (!terminals.some((t) => t.key === use.key)) terminals.push(use)
      return { history: [...state.history.slice(0, -1), { ...last, terminals }] }
    })
  },

  undoLast: async () => {
    // A step waiting for the presenter (menu, lab, command) is cancelled instead.
    if (get().runningStepId) return cancelWaiting() && false
    const last = get().history[get().history.length - 1]
    if (!last) return false
    try {
      await revertChanges(last.changes)
      stopTerminals(last.terminals ?? [])
      useStageStore.getState().restore(last.stage)
      closeStageTabs(last.stage)
      set((state) => ({
        history: state.history.slice(0, -1),
        variables: last.variables ?? state.variables
      }))
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
    set({ history: [], variables: {}, sessionStartedAt: null, stepStartedAt: null, chapters: [] })
    useIDEStore.getState().notify('Aula resetada.', 'success')
  },

  skip: () => skipAnimation(),

  restartClock: () => set({ sessionStartedAt: Date.now(), chapters: [] }),

  clear: () =>
    set({
      history: [],
      variables: {},
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
        variables: session.variables ?? {},
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
  if (
    state.history === prev.history &&
    state.chapters === prev.chapters &&
    state.variables === prev.variables
  ) {
    return
  }
  const root = useFileSystemStore.getState().rootPath
  if (!root) return
  // Captured now so a later workspace switch can't write this data elsewhere.
  const file: SessionFile = {
    history: state.history,
    variables: state.variables,
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
