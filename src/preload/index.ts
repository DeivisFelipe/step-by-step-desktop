import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { CustomAPI } from './index.d'

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

  getAvailableShells: () => ipcRenderer.invoke('terminal:get-shells'),
  createTerminal: (options) => ipcRenderer.invoke('terminal:create', options),
  onTerminalData: (callback) => {
    const listener = (_event: IpcRendererEvent, id: number, data: string): void =>
      callback(id, data)
    ipcRenderer.on('terminal:data', listener)
    return () => ipcRenderer.removeListener('terminal:data', listener)
  },
  onTerminalExit: (callback) => {
    const listener = (_event: IpcRendererEvent, id: number, code: number | null): void =>
      callback(id, code)
    ipcRenderer.on('terminal:exit', listener)
    return () => ipcRenderer.removeListener('terminal:exit', listener)
  },
  sendTerminalInput: (id, data) => ipcRenderer.send('terminal:input', id, data),
  resizeTerminal: (id, cols, rows) => ipcRenderer.send('terminal:resize', id, cols, rows),
  killTerminal: (id) => ipcRenderer.send('terminal:kill', id)
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
