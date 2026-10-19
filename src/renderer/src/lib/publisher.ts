import { PresenterPayload, StagePayload } from '../../../shared/presentation'
import { useFileSystemStore } from '../store/useFileSystemStore'
import { useIDEStore } from '../store/useIDEStore'
import { useLessonStore } from '../store/useLessonStore'
import { getCurrentStep, getNextStep, usePlayerStore } from '../store/usePlayerStore'
import { useStageStore } from '../store/useStageStore'
import { useTerminalStore } from '../store/useTerminalStore'
import { flattenSteps, flowOf } from './tree'
import { basename, relativeTo, samePath } from './paths'
import { getCodeEditor, getTerminalId } from './registry'
import { modelPathFor } from './monaco'

// Mirrors the IDE state to the presentation pages (OBS, presenter view, students).

/** Monaco language ids that Shiki names differently. */
const SHIKI_LANG: Record<string, string> = { plaintext: 'text', shell: 'bash' }

let codeVersion = 0
let lastContent: string | null = null
let lastPath: string | null = null

function buildStage(): StagePayload {
  const fs = useFileSystemStore.getState()
  const lesson = useLessonStore.getState()
  const player = usePlayerStore.getState()
  const stage = useStageStore.getState()
  const terminals = useTerminalStore.getState()

  const steps = flattenSteps(lesson.tree)
  const current = getCurrentStep(lesson.tree, player.history, player.runningStepId)
  const index = current ? steps.findIndex((s) => s.id === current.id) : -1

  const codePath = stage.highlight?.path ?? useIDEStore.getState().activeFilePath()
  const file = codePath ? fs.files[codePath] : undefined
  let code: StagePayload['code'] = null
  if (codePath && file) {
    if (file.content !== lastContent || codePath !== lastPath) {
      codeVersion++
      lastContent = file.content
      lastPath = codePath
    }
    const editor = getCodeEditor()
    const cursorLine =
      editor?.getModel()?.uri.toString() === modelPathFor(codePath)
        ? (editor.getPosition()?.lineNumber ?? 1)
        : 1
    const highlight =
      stage.highlight && samePath(stage.highlight.path, codePath)
        ? {
            startLine: stage.highlight.startLine,
            endLine: stage.highlight.endLine,
            note: stage.highlight.note
          }
        : null
    code = {
      path: relativeTo(fs.rootPath, codePath),
      language: SHIKI_LANG[file.language] ?? file.language,
      content: file.content,
      highlight,
      cursorLine,
      transition: stage.codeTransition,
      version: codeVersion
    }
  }

  const terminalKey = stage.terminalKey ?? terminals.activeKey
  return {
    lessonTitle: lesson.title || (fs.rootPath ? basename(fs.rootPath) : ''),
    flowTitle: current ? (flowOf(lesson.tree, current)?.title ?? '') : '',
    stepTitle: current?.title ?? '',
    stepNumber: index + 1,
    stepTotal: steps.length,
    view: stage.view,
    code,
    terminalId: getTerminalId(terminalKey),
    terminalName: terminals.sessions.find((s) => s.key === terminalKey)?.name ?? '',
    slide: stage.slide,
    challenge: stage.challenge,
    preview: stage.preview,
    caption: current?.data?.caption ?? '',
    running: player.runningStepId !== null
  }
}

function buildPresenter(): PresenterPayload {
  const lesson = useLessonStore.getState()
  const player = usePlayerStore.getState()
  const executed = new Set(player.history.map((h) => h.stepId))
  const current = getCurrentStep(lesson.tree, player.history, player.runningStepId)
  return {
    steps: flattenSteps(lesson.tree).map((step, i) => ({
      id: step.id,
      title: step.title,
      flowTitle: flowOf(lesson.tree, step)?.title ?? '',
      number: i + 1,
      executed: executed.has(step.id),
      notes: step.data?.presenterNotes ?? '',
      caption: step.data?.caption ?? ''
    })),
    currentId: current?.id ?? null,
    nextId: getNextStep(lesson.tree, player.history)?.id ?? null,
    runningId: player.runningStepId,
    sessionStartedAt: player.sessionStartedAt,
    stepStartedAt: player.stepStartedAt
  }
}

let started = false

export function startPublisher(): void {
  if (started) return
  started = true

  let stageScheduled = false
  const publishStage = (): void => {
    stageScheduled = false
    window.api.publishStage(buildStage())
  }
  // ~30 updates per second at most while typing.
  const scheduleStage = (): void => {
    if (stageScheduled) return
    stageScheduled = true
    setTimeout(publishStage, 33)
  }

  let presenterScheduled = false
  const schedulePresenter = (): void => {
    if (presenterScheduled) return
    presenterScheduled = true
    setTimeout(() => {
      presenterScheduled = false
      window.api.publishPresenter(buildPresenter())
    }, 100)
  }

  for (const store of [useFileSystemStore, useIDEStore, useStageStore, useTerminalStore] as const) {
    ;(store as { subscribe: (fn: () => void) => void }).subscribe(scheduleStage)
  }
  useLessonStore.subscribe(() => {
    scheduleStage()
    schedulePresenter()
  })
  usePlayerStore.subscribe(() => {
    scheduleStage()
    schedulePresenter()
  })
  // Terminal ids are assigned asynchronously; a slow heartbeat keeps pages in sync.
  setInterval(scheduleStage, 1000)
  scheduleStage()
  schedulePresenter()
}

/** Handles commands from the presenter view or a phone. */
export function startRemoteControl(): void {
  window.api.onRemoteCommand((command) => {
    const player = usePlayerStore.getState()
    switch (command.command) {
      case 'next':
        player.runNext()
        break
      case 'prev':
        player.undoLast()
        break
      case 'skip':
        player.skip()
        break
      case 'goto':
        player.goTo(command.stepId)
        break
    }
  })
}
