import { ElectronAPI } from '@electron-toolkit/preload'
import type {
  ExecRequest,
  ExecResult,
  GitCommit,
  GitExportStep,
  GitFileChange,
  ObsStatus,
  SaveDialogOptions,
  ServerInfo,
  UpdateStatus
} from '../shared/ipc'
import type {
  AppSettings,
  PresenterPayload,
  RemoteCommand,
  StagePayload
} from '../shared/presentation'

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

export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] }

export interface CustomAPI {
  openFolder: (title?: string) => Promise<string | null>
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
  showSaveDialog: (options: SaveDialogOptions) => Promise<string | null>
  showOpenFileDialog: (options: SaveDialogOptions) => Promise<string | null>
  /** Renders HTML to a PDF file. */
  exportPdf: (html: string, path: string) => Promise<void>

  getAvailableShells: () => Promise<string[]>
  createTerminal: (options?: { shell?: string; cwd?: string }) => Promise<number>
  onTerminalData: (callback: (id: number, data: string) => void) => () => void
  onTerminalExit: (callback: (id: number, code: number | null) => void) => () => void
  sendTerminalInput: (id: number, data: string) => void
  resizeTerminal: (id: number, cols: number, rows: number) => void
  killTerminal: (id: number) => void

  getSettings: () => Promise<AppSettings>
  updateSettings: (partial: DeepPartial<AppSettings>) => Promise<AppSettings>
  /** Replaces a whole preset (presets are records, not deep-merged). */
  savePreset: (
    name: string,
    style: AppSettings['presentation']['presets'][string] | null
  ) => Promise<AppSettings>
  onSettingsChanged: (callback: (settings: AppSettings) => void) => () => void

  getServerInfo: () => Promise<ServerInfo>
  /** Serves an HTML slide from the presentation server; returns its path. */
  registerSlide: (html: string) => Promise<string>
  onServerInfo: (callback: (info: ServerInfo) => void) => () => void
  publishStage: (payload: StagePayload) => void
  publishPresenter: (payload: PresenterPayload) => void
  onRemoteCommand: (callback: (command: RemoteCommand) => void) => () => void
  openPresenterWindow: () => void
  /** Folder served under /arquivos for slide images and previews. */
  setWorkspaceRoot: (root: string | null) => void

  obsStatus: () => Promise<ObsStatus>
  onObsStatus: (callback: (status: ObsStatus) => void) => () => void
  obsSetScene: (scene: string) => void
  obsChapter: (title: string) => void

  snapshotCreate: (root: string) => Promise<void>
  snapshotExists: (root: string) => Promise<boolean>
  snapshotRestore: (root: string) => Promise<void>
  snapshotDelete: (root: string) => Promise<void>

  rehearsalPrepare: (root: string) => Promise<string>
  rehearsalWrite: (dir: string, files: Record<string, string | null>) => Promise<void>
  rehearsalExec: (request: ExecRequest) => Promise<ExecResult>
  rehearsalCleanup: (dir: string) => Promise<void>

  getUpdateStatus: () => Promise<UpdateStatus>
  checkForUpdates: () => Promise<UpdateStatus>
  /** Closes the app and installs the downloaded version. */
  installUpdate: () => void
  /** Opens the log of update checks. */
  openUpdateLog: () => void
  onUpdateStatus: (callback: (status: UpdateStatus) => void) => () => void

  gitLog: (root: string) => Promise<GitCommit[]>
  gitCommitChanges: (root: string, hash: string) => Promise<GitFileChange[]>
  gitExport: (root: string, target: string, steps: GitExportStep[]) => Promise<void>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: CustomAPI
  }
}
