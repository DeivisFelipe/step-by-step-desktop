import { create } from 'zustand'
import { basename, dirname, isInside, languageFromPath, replacePrefix } from '../lib/paths'
import { useIDEStore } from './useIDEStore'

export interface FileNode {
  name: string
  path: string
  isDirectory: boolean
  children?: FileNode[]
}

export interface OpenFile {
  content: string
  /** Content as it is on disk; differs from `content` while there are unsaved edits. */
  savedContent: string
  language: string
}

/** Entries never shown in the explorer (`.stepbystep` holds the lesson file). */
const HIDDEN_ENTRIES = new Set(['.git', '.stepbystep'])

interface FileSystemState {
  rootPath: string | null
  fileTree: FileNode[]
  expanded: Record<string, boolean>
  selectedPath: string | null
  files: Record<string, OpenFile>

  openFolder: (path: string) => Promise<void>
  refreshTree: () => Promise<void>
  toggleDirectory: (path: string) => Promise<void>
  expandTo: (path: string) => Promise<void>
  collapseAll: () => void
  select: (path: string | null) => void

  /** Loads a file into the cache. With `force`, re-reads it from disk. Returns false if missing. */
  loadFile: (path: string, force?: boolean) => Promise<boolean>
  setContent: (path: string, content: string) => void
  saveFile: (path: string) => Promise<void>
  /** Writes to disk and updates the cache as saved content. */
  writeFile: (path: string, content: string) => Promise<void>
  forgetFile: (path: string) => void

  createFile: (path: string, content?: string) => Promise<void>
  createDirectory: (path: string) => Promise<void>
  deleteNode: (path: string) => Promise<void>
  renameNode: (oldPath: string, newPath: string) => Promise<void>
}

async function readTree(dir: string, expanded: Record<string, boolean>): Promise<FileNode[]> {
  const entries = await window.api.readDir(dir)
  const visible = entries
    .filter((e) => !HIDDEN_ENTRIES.has(e.name))
    .sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    })
  return Promise.all(
    visible.map(async (entry) => ({
      name: entry.name,
      path: entry.path,
      isDirectory: entry.isDirectory,
      children:
        entry.isDirectory && expanded[entry.path] ? await readTree(entry.path, expanded) : undefined
    }))
  )
}

export const useFileSystemStore = create<FileSystemState>((set, get) => ({
  rootPath: null,
  fileTree: [],
  expanded: {},
  selectedPath: null,
  files: {},

  openFolder: async (path) => {
    set({ rootPath: path, fileTree: [], expanded: {}, selectedPath: null, files: {} })
    await get().refreshTree()
  },

  refreshTree: async () => {
    const { rootPath, expanded } = get()
    if (!rootPath) return
    const tree = await readTree(rootPath, expanded)
    // The workspace may have changed while we were reading.
    if (get().rootPath === rootPath) set({ fileTree: tree })
  },

  toggleDirectory: async (path) => {
    set((state) => ({ expanded: { ...state.expanded, [path]: !state.expanded[path] } }))
    await get().refreshTree()
  },

  expandTo: async (path) => {
    const { rootPath } = get()
    if (!rootPath || !isInside(path, rootPath)) return
    const expanded = { ...get().expanded }
    let dir = dirname(path)
    while (isInside(dir, rootPath) && dir !== rootPath && dir.length > rootPath.length) {
      expanded[dir] = true
      dir = dirname(dir)
    }
    set({ expanded })
    await get().refreshTree()
  },

  collapseAll: () => {
    set({ expanded: {} })
    get().refreshTree()
  },

  select: (path) => set({ selectedPath: path }),

  loadFile: async (path, force = false) => {
    const cached = get().files[path]
    if (cached && !force) return true
    const content = await window.api.readFile(path)
    if (content === null) return false
    set((state) => ({
      files: {
        ...state.files,
        [path]: { content, savedContent: content, language: languageFromPath(path) }
      }
    }))
    return true
  },

  setContent: (path, content) => {
    const file = get().files[path]
    if (!file || file.content === content) return
    set((state) => ({ files: { ...state.files, [path]: { ...file, content } } }))
  },

  saveFile: async (path) => {
    const file = get().files[path]
    if (!file) return
    const content = file.content
    await window.api.writeFile(path, content)
    set((state) => ({
      files: { ...state.files, [path]: { ...state.files[path], savedContent: content } }
    }))
  },

  writeFile: async (path, content) => {
    await window.api.writeFile(path, content)
    set((state) => ({
      files: {
        ...state.files,
        [path]: { content, savedContent: content, language: languageFromPath(path) }
      }
    }))
  },

  forgetFile: (path) => {
    set((state) => {
      const files = { ...state.files }
      delete files[path]
      return { files }
    })
  },

  createFile: async (path, content = '') => {
    if (await window.api.exists(path)) throw new Error(`"${basename(path)}" já existe.`)
    await get().writeFile(path, content)
    await get().expandTo(path)
    set({ selectedPath: path })
    useIDEStore.getState().openFileTab(path)
  },

  createDirectory: async (path) => {
    if (await window.api.exists(path)) throw new Error(`"${basename(path)}" já existe.`)
    await window.api.createDir(path)
    set((state) => ({ expanded: { ...state.expanded, [path]: true }, selectedPath: path }))
    await get().expandTo(path)
  },

  deleteNode: async (path) => {
    await window.api.delete(path)
    useIDEStore.getState().closeTabsUnder(path)
    set((state) => {
      const files = Object.fromEntries(
        Object.entries(state.files).filter(([p]) => !isInside(p, path))
      )
      return {
        files,
        selectedPath:
          state.selectedPath && isInside(state.selectedPath, path) ? null : state.selectedPath
      }
    })
    await get().refreshTree()
  },

  renameNode: async (oldPath, newPath) => {
    if (oldPath === newPath) return
    await window.api.rename(oldPath, newPath)
    const move = (p: string): string =>
      isInside(p, oldPath) ? replacePrefix(p, oldPath, newPath) : p
    set((state) => ({
      files: Object.fromEntries(
        Object.entries(state.files).map(([p, f]) => [
          move(p),
          { ...f, language: languageFromPath(move(p)) }
        ])
      ),
      expanded: Object.fromEntries(Object.entries(state.expanded).map(([p, v]) => [move(p), v])),
      selectedPath: state.selectedPath ? move(state.selectedPath) : null
    }))
    useIDEStore.getState().renamePath(oldPath, newPath)
    await get().refreshTree()
  }
}))
