import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { CustomAPI } from './index.d'

/** Subscribes to a channel and returns the unsubscribe function. */
function listen<T extends unknown[]>(channel: string, callback: (...args: T) => void): () => void {
  const listener = (_event: IpcRendererEvent, ...args: unknown[]): void => callback(...(args as T))
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: CustomAPI = {
  openFolder: () => ipcRenderer.invoke('file:open-folder'),
  readDir: (path) => ipcRenderer.invoke('file:read-dir', path),
  exists: (path) => ipcRenderer.invoke('file:exists', path),
  readFile: (path) => ipcRenderer.invoke('file:read', path),
  writeFile: (path, content) => ipcRenderer.invoke('file:write', path, content),
  createDir: (path) => ipcRenderer.invoke('file:create-dir', path),
  delete: (path) => ipcRenderer.invoke('file:delete', path),
  rename: (oldPath, newPath) => ipcRenderer.invoke('file:rename', oldPath, newPath),
  reveal: (path) => ipcRenderer.invoke('file:reveal', path),

  showMessage: (options) => ipcRenderer.invoke('dialog:message', options),
  showSaveDialog: (options) => ipcRenderer.invoke('dialog:save', options),
  showOpenFileDialog: (options) => ipcRenderer.invoke('dialog:open-file', options),
  exportPdf: (html, path) => ipcRenderer.invoke('export:pdf', html, path),

  getAvailableShells: () => ipcRenderer.invoke('terminal:get-shells'),
  createTerminal: (options) => ipcRenderer.invoke('terminal:create', options),
  onTerminalData: (callback) => listen('terminal:data', callback),
  onTerminalExit: (callback) => listen('terminal:exit', callback),
  sendTerminalInput: (id, data) => ipcRenderer.send('terminal:input', id, data),
  resizeTerminal: (id, cols, rows) => ipcRenderer.send('terminal:resize', id, cols, rows),
  killTerminal: (id) => ipcRenderer.send('terminal:kill', id),

  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (partial) => ipcRenderer.invoke('settings:update', partial),
  savePreset: (name, style) => ipcRenderer.invoke('settings:save-preset', name, style),
  onSettingsChanged: (callback) => listen('settings:changed', callback),

  getServerInfo: () => ipcRenderer.invoke('server:info'),
  onServerInfo: (callback) => listen('server:info', callback),
  publishStage: (payload) => ipcRenderer.send('stage:publish', payload),
  publishPresenter: (payload) => ipcRenderer.send('presenter:publish', payload),
  onRemoteCommand: (callback) => listen('remote:command', callback),
  openPresenterWindow: () => ipcRenderer.send('presenter:open'),
  setWorkspaceRoot: (root) => ipcRenderer.send('workspace:set-root', root),

  obsStatus: () => ipcRenderer.invoke('obs:status'),
  onObsStatus: (callback) => listen('obs:status', callback),
  obsSetScene: (scene) => ipcRenderer.send('obs:set-scene', scene),
  obsChapter: (title) => ipcRenderer.send('obs:chapter', title),

  snapshotCreate: (root) => ipcRenderer.invoke('snapshot:create', root),
  snapshotExists: (root) => ipcRenderer.invoke('snapshot:exists', root),
  snapshotRestore: (root) => ipcRenderer.invoke('snapshot:restore', root),
  snapshotDelete: (root) => ipcRenderer.invoke('snapshot:delete', root),

  rehearsalPrepare: (root) => ipcRenderer.invoke('rehearsal:prepare', root),
  rehearsalWrite: (dir, files) => ipcRenderer.invoke('rehearsal:write', dir, files),
  rehearsalExec: (request) => ipcRenderer.invoke('rehearsal:exec', request),
  rehearsalCleanup: (dir) => ipcRenderer.invoke('rehearsal:cleanup', dir),

  gitLog: (root) => ipcRenderer.invoke('git:log', root),
  gitCommitChanges: (root, hash) => ipcRenderer.invoke('git:commit-changes', root, hash),
  gitExport: (root, target, steps) => ipcRenderer.invoke('git:export', root, target, steps)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (declared in index.d.ts)
  window.electron = electronAPI
  // @ts-ignore (declared in index.d.ts)
  window.api = api
}
