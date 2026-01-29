import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface CustomAPI {
    openFolder: () => Promise<string | null>
    readDir: (path: string) => Promise<any[]>
    readFile: (path: string) => Promise<string>
    writeFile: (path: string, content: string) => Promise<void>
    createDir: (path: string) => Promise<void>
    delete: (path: string) => Promise<void>
    rename: (oldPath: string, newPath: string) => Promise<void>
    
    createTerminal: () => void
    onTerminalData: (callback: (data: string) => void) => () => void
    sendTerminalInput: (data: string) => void
    resizeTerminal: (cols: number, rows: number) => void
  }

  interface Window {
    electron: ElectronAPI
    api: CustomAPI
  }
}
