import { useFileSystemStore } from '../store/useFileSystemStore'
import { reportError, useIDEStore } from '../store/useIDEStore'
import { useLessonStore } from '../store/useLessonStore'
import { usePlayerStore } from '../store/usePlayerStore'
import { basename } from './paths'

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

export async function openWorkspace(path: string): Promise<void> {
  if (!(await window.api.exists(path))) {
    forgetFolder(path)
    useIDEStore.getState().notify(`A pasta não existe mais: ${path}`, 'warning')
    return
  }
  if (!(await confirmUnsavedChanges())) return

  try {
    usePlayerStore.getState().clear()
    useIDEStore.getState().closeAllTabs()
    await useFileSystemStore.getState().openFolder(path)
    await useLessonStore.getState().loadForWorkspace(path)
    rememberFolder(path)
    document.title = `${basename(path)} — Step-by-Step Code`
  } catch (e) {
    reportError(e, 'Não foi possível abrir a pasta')
  }
}

export async function chooseWorkspace(): Promise<void> {
  const path = await window.api.openFolder()
  if (path) await openWorkspace(path)
}

export async function restoreLastWorkspace(): Promise<void> {
  const last = getRecentFolders()[0]
  if (last && (await window.api.exists(last))) await openWorkspace(last)
}
