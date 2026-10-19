// Payloads exchanged between the main process and the IDE over IPC.

export interface ServerInfo {
  port: number
  /** Base URL on this machine, e.g. http://127.0.0.1:4545 */
  localUrl: string
  /** Base URL on the local network, when sharing is on. */
  lanUrl: string | null
  token: string
  error: string | null
}

export interface ObsStatus {
  enabled: boolean
  connected: boolean
  error: string | null
  scenes: string[]
}

export interface ExecRequest {
  cwd: string
  command: string
  shell: string
  /** Stop successfully as soon as this text shows up in the output. */
  waitFor?: string
  timeoutMs: number
}

export interface ExecResult {
  ok: boolean
  code: number | null
  output: string
  timedOut: boolean
  matched: boolean
}

export interface GitCommit {
  hash: string
  subject: string
  body: string
  date: string
}

export interface GitFileChange {
  status: 'A' | 'M' | 'D'
  path: string
  /** null when the file is binary or did not exist. */
  before: string | null
  after: string | null
}

export interface GitExportStep {
  message: string
  /** Relative path → new content, or null to delete. */
  files: Record<string, string | null>
}

export interface SaveDialogOptions {
  title?: string
  defaultPath?: string
  filters?: { name: string; extensions: string[] }[]
}
