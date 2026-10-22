import { useFileSystemStore } from '../store/useFileSystemStore'
import { reportError, useIDEStore } from '../store/useIDEStore'
import { useLessonStore } from '../store/useLessonStore'
import { usePlayerStore } from '../store/usePlayerStore'
import { useStageStore } from '../store/useStageStore'
import { useTerminalStore } from '../store/useTerminalStore'
import { basename } from './paths'
import { cancelWaiting } from '../engine/ExecutionEngine'

const RECENT_KEY = 'ssc-recent-folders'
const MAX_RECENT = 6

export function getRecentFolders(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
    return Array.isArray(value) ? value.filter((v) => typeof v === 'string') : []
  } catch {
    return []
  }
}

function rememberFolder(path: string): void {
  const recent = [path, ...getRecentFolders().filter((p) => p !== path)].slice(0, MAX_RECENT)
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent))
  } catch {
    // storage unavailable: recents are only a convenience
  }
}

export function forgetFolder(path: string): void {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(getRecentFolders().filter((p) => p !== path)))
  } catch {
    // ignore
  }
}

/** Asks what to do with unsaved files. Resolves to false if the user cancelled. */
export async function confirmUnsavedChanges(): Promise<boolean> {
  const fs = useFileSystemStore.getState()
  const dirty = Object.entries(fs.files).filter(([, f]) => f.content !== f.savedContent)
  if (dirty.length === 0) return true
  const choice = await window.api.showMessage({
    type: 'warning',
    message:
      dirty.length === 1
        ? `Salvar as alterações em ${basename(dirty[0][0])}?`
        : `Salvar as alterações em ${dirty.length} arquivos?`,
    detail: 'Suas alterações serão perdidas se você não salvá-las.',
    buttons: ['Salvar', 'Não salvar', 'Cancelar'],
    defaultId: 0,
    cancelId: 2
  })
  if (choice === 2) return false
  if (choice === 0) {
    for (const [path] of dirty) await fs.saveFile(path)
  }
  return true
}

/**
 * A step still running (or waiting on a menu, lab or command) would go on in the next
 * project: a waiting one is cancelled (its changes undone), an animation is skipped.
 */
async function stopRunningStep(): Promise<void> {
  const player = usePlayerStore.getState()
  if (!player.runningStepId) return
  if (!cancelWaiting()) player.skip()
  for (let i = 0; i < 100 && usePlayerStore.getState().runningStepId; i++) {
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
}

export async function openWorkspace(path: string): Promise<void> {
  if (!(await window.api.exists(path))) {
    forgetFolder(path)
    useIDEStore.getState().notify(`A pasta não existe mais: ${path}`, 'warning')
    return
  }
  if (!(await confirmUnsavedChanges())) return
  await stopRunningStep()

  try {
    useIDEStore.getState().closeAllTabs()
    useStageStore.getState().reset()
    useTerminalStore.getState().resetAll()
    await useFileSystemStore.getState().openFolder(path)
    window.api.setWorkspaceRoot(path)
    await useLessonStore.getState().loadForWorkspace(path)
    await usePlayerStore.getState().loadSession(path)
    rememberFolder(path)
    document.title = `${basename(path)} — Step-by-Step Code`
  } catch (e) {
    reportError(e, 'Não foi possível abrir a pasta')
  }
}

/** Closes the current project and goes back to the start screen. */
export async function closeWorkspace(): Promise<void> {
  if (!useFileSystemStore.getState().rootPath) return
  if (!(await confirmUnsavedChanges())) return
  await stopRunningStep()
  useIDEStore.getState().closeAllTabs()
  useStageStore.getState().reset()
  usePlayerStore.getState().clear()
  useTerminalStore.getState().resetAll()
  await useLessonStore.getState().closeWorkspace()
  useFileSystemStore.getState().closeFolder()
  window.api.setWorkspaceRoot(null)
  document.title = 'Step-by-Step Code'
}

export async function chooseWorkspace(): Promise<void> {
  const path = await window.api.openFolder()
  if (path) await openWorkspace(path)
}

export async function restoreLastWorkspace(): Promise<void> {
  const last = getRecentFolders()[0]
  if (last && (await window.api.exists(last))) await openWorkspace(last)
}
