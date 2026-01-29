import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  openFolder: () => ipcRenderer.invoke('file:open-folder'),
  readDir: (path: string) => ipcRenderer.invoke('file:read-dir', path),
  readFile: (path: string) => ipcRenderer.invoke('file:read', path),
  writeFile: (path: string, content: string) => ipcRenderer.invoke('file:write', path, content),
  createDir: (path: string) => ipcRenderer.invoke('file:create-dir', path),
  delete: (path: string) => ipcRenderer.invoke('file:delete', path),
  rename: (oldPath: string, newPath: string) => ipcRenderer.invoke('file:rename', oldPath, newPath),
  
  createTerminal: () => ipcRenderer.send('terminal:create'),
  onTerminalData: (callback: (data: string) => void) => {
    const subscription = (_event: any, data: string) => callback(data);
    ipcRenderer.on('terminal:data', subscription);
    return () => ipcRenderer.removeListener('terminal:data', subscription);
  },
  sendTerminalInput: (data: string) => ipcRenderer.send('terminal:input', data),
  resizeTerminal: (cols: number, rows: number) => ipcRenderer.send('terminal:resize', { cols, rows })
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
