import { ElectronAPI } from '@electron-toolkit/preload'

export interface DirEntry {
  name: string
  isDirectory: boolean
  path: string
}

export interface MessageOptions {
  type?: 'none' | 'info' | 'error' | 'question' | 'warning'
  title?: string
  message: string
  detail?: string
  buttons?: string[]
  defaultId?: number
  cancelId?: number
}

export interface CustomAPI {
  openFolder: () => Promise<string | null>
  readDir: (path: string) => Promise<DirEntry[]>
  exists: (path: string) => Promise<boolean>
  /** Resolves to null when the file does not exist or cannot be read. */
  readFile: (path: string) => Promise<string | null>
  writeFile: (path: string, content: string) => Promise<void>
  createDir: (path: string) => Promise<void>
  delete: (path: string) => Promise<void>
  rename: (oldPath: string, newPath: string) => Promise<void>
  reveal: (path: string) => Promise<void>

  /** Native message box; resolves to the index of the clicked button. */
  showMessage: (options: MessageOptions) => Promise<number>

  getAvailableShells: () => Promise<string[]>
  createTerminal: (options?: { shell?: string; cwd?: string }) => Promise<number>
  onTerminalData: (callback: (id: number, data: string) => void) => () => void
  onTerminalExit: (callback: (id: number, code: number | null) => void) => () => void
  sendTerminalInput: (id: number, data: string) => void
  resizeTerminal: (id: number, cols: number, rows: number) => void
  killTerminal: (id: number) => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: CustomAPI
  }
}
