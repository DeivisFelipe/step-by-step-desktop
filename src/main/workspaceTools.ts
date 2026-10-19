import { BrowserWindow, dialog, ipcMain } from 'electron'
import { execFile, spawn } from 'child_process'
import { promisify } from 'util'
import { basename, dirname, join, relative, sep } from 'path'
import * as fs from 'fs'
import os from 'os'
import type {
  ExecRequest,
  ExecResult,
  GitCommit,
  GitExportStep,
  GitFileChange,
  SaveDialogOptions
} from '../shared/ipc'

const execFileAsync = promisify(execFile)

/** Never copied, compared or deleted: dependencies, VCS data and the app's own folder. */
const IGNORED = new Set(['node_modules', '.git', '.stepbystep', '.venv', 'venv'])

function isIgnored(root: string, path: string): boolean {
  const rel = relative(root, path)
  if (!rel || rel.startsWith('..')) return false
  return rel.split(sep).some((part) => IGNORED.has(part))
}

function snapshotDir(root: string): string {
  return join(root, '.stepbystep', 'inicio')
}

async function copyWorkspace(from: string, to: string): Promise<void> {
  await fs.promises.mkdir(to, { recursive: true })
  // Entry by entry: `to` may live inside `from` (.stepbystep/inicio), which cp() refuses.
  for (const entry of await fs.promises.readdir(from)) {
    if (IGNORED.has(entry)) continue
    await fs.promises.cp(join(from, entry), join(to, entry), {
      recursive: true,
      force: true,
      filter: (src) => !isIgnored(from, src)
    })
  }
}

/** Files (relative paths) under `root`, skipping ignored folders. */
async function listFiles(root: string, dir = root, out: string[] = []): Promise<string[]> {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (isIgnored(root, full)) continue
    if (entry.isDirectory()) await listFiles(root, full, out)
    else out.push(relative(root, full))
  }
  return out
}

async function removeEmptyDirs(root: string, dir: string, keep: string): Promise<void> {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (!entry.isDirectory() || isIgnored(root, full)) continue
    await removeEmptyDirs(root, full, keep)
    const inSnapshot = fs.existsSync(join(keep, relative(root, full)))
    if (!inSnapshot && (await fs.promises.readdir(full)).length === 0) {
      await fs.promises.rmdir(full)
    }
  }
}

// --- Shell commands (rehearsal) ------------------------------------------------

function shellArgs(shell: string, command: string): string[] {
  const name = basename(shell).toLowerCase()
  if (name.startsWith('powershell') || name.startsWith('pwsh')) {
    return ['-NoProfile', '-NonInteractive', '-Command', command]
  }
  if (name.startsWith('cmd')) return ['/d', '/s', '/c', command]
  if (name.startsWith('wsl')) return ['-e', 'bash', '-lc', command]
  return ['-lc', command]
}

function matches(output: string, pattern: string): boolean {
  const regex = /^\/(.+)\/([a-z]*)$/.exec(pattern)
  if (regex) {
    try {
      return new RegExp(regex[1], regex[2]).test(output)
    } catch {
      // fall back to plain text
    }
  }
  return output.toLowerCase().includes(pattern.toLowerCase())
}

function killTree(pid: number | undefined): void {
  if (!pid) return
  try {
    if (process.platform === 'win32') spawn('taskkill', ['/pid', String(pid), '/T', '/F'])
    else process.kill(-pid, 'SIGKILL')
  } catch {
    // already gone
  }
}

function runCommand(request: ExecRequest): Promise<ExecResult> {
  return new Promise((resolve) => {
    let output = ''
    let finished = false
    const child = spawn(request.shell, shellArgs(request.shell, request.command), {
      cwd: request.cwd,
      env: { ...process.env, CI: '1', FORCE_COLOR: '0' },
      detached: process.platform !== 'win32',
      windowsHide: true
    })

    const finish = (result: Omit<ExecResult, 'output'>): void => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      killTree(child.pid)
      // eslint-disable-next-line no-control-regex
      resolve({ ...result, output: output.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '').slice(-4000) })
    }

    const onData = (data: Buffer): void => {
      output += data.toString()
      if (output.length > 200_000) output = output.slice(-100_000)
      if (request.waitFor && matches(output, request.waitFor)) {
        finish({ ok: true, code: null, timedOut: false, matched: true })
      }
    }
    child.stdout?.on('data', onData)
    child.stderr?.on('data', onData)
    child.on('error', (err) => {
      output += `\n${err.message}`
      finish({ ok: false, code: null, timedOut: false, matched: false })
    })
    child.on('exit', (code) => finish({ ok: code === 0, code, timedOut: false, matched: false }))
    const timer = setTimeout(
      () => finish({ ok: false, code: null, timedOut: true, matched: false }),
      request.timeoutMs
    )
  })
}

// --- Git -------------------------------------------------------------------------

async function git(cwd: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', args, {
      cwd,
      maxBuffer: 100 * 1024 * 1024,
      windowsHide: true
    })
    return stdout
  } catch (e) {
    const err = e as NodeJS.ErrnoException & { stderr?: string }
    if (err.code === 'ENOENT') throw new Error('O git não está instalado ou não está no PATH.')
    throw new Error(err.stderr?.trim() || err.message)
  }
}

/** File content at a revision, or null when missing or binary. */
async function gitShow(cwd: string, spec: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('git', ['show', spec], {
      cwd,
      maxBuffer: 100 * 1024 * 1024,
      encoding: 'buffer',
      windowsHide: true
    })
    const buffer = stdout as unknown as Buffer
    if (buffer.includes(0)) return null
    return buffer.toString('utf-8')
  } catch {
    return null
  }
}

async function gitIdentityArgs(cwd: string): Promise<string[]> {
  const name = await git(cwd, ['config', 'user.name']).catch(() => '')
  const email = await git(cwd, ['config', 'user.email']).catch(() => '')
  const args: string[] = []
  if (!name.trim()) args.push('-c', 'user.name=Step-by-Step Code')
  if (!email.trim()) args.push('-c', 'user.email=aula@stepbystep.local')
  return args
}

export function setupWorkspaceTools(): void {
  // --- Start snapshot ---
  ipcMain.handle('snapshot:exists', (_, root: string) => fs.existsSync(snapshotDir(root)))

  ipcMain.handle('snapshot:create', async (_, root: string) => {
    const dir = snapshotDir(root)
    await fs.promises.rm(dir, { recursive: true, force: true })
    await copyWorkspace(root, dir)
  })

  ipcMain.handle('snapshot:restore', async (_, root: string) => {
    const dir = snapshotDir(root)
    if (!fs.existsSync(dir)) throw new Error('Não há ponto de partida salvo.')
    for (const rel of await listFiles(root)) {
      if (!fs.existsSync(join(dir, rel))) await fs.promises.rm(join(root, rel), { force: true })
    }
    await removeEmptyDirs(root, root, dir)
    await fs.promises.cp(dir, root, { recursive: true, force: true })
  })

  ipcMain.handle('snapshot:delete', async (_, root: string) => {
    await fs.promises.rm(snapshotDir(root), { recursive: true, force: true })
  })

  // --- Rehearsal ---
  ipcMain.handle('rehearsal:prepare', async (_, base: string) => {
    const dir = await fs.promises.mkdtemp(join(os.tmpdir(), 'ssc-ensaio-'))
    await copyWorkspace(base, dir)
    return dir
  })

  ipcMain.handle(
    'rehearsal:write',
    async (_, dir: string, files: Record<string, string | null>) => {
      for (const [rel, content] of Object.entries(files)) {
        const target = join(dir, rel)
        if (relative(dir, target).startsWith('..')) continue
        if (content === null) await fs.promises.rm(target, { force: true, recursive: true })
        else {
          await fs.promises.mkdir(dirname(target), { recursive: true })
          await fs.promises.writeFile(target, content, 'utf-8')
        }
      }
    }
  )

  ipcMain.handle('rehearsal:exec', (_, request: ExecRequest) => runCommand(request))

  ipcMain.handle('rehearsal:cleanup', async (_, dir: string) => {
    if (basename(dir).startsWith('ssc-ensaio-')) {
      await fs.promises.rm(dir, { recursive: true, force: true }).catch(() => {})
    }
  })

  // --- Git ---
  ipcMain.handle('git:log', async (_, root: string): Promise<GitCommit[]> => {
    const out = await git(root, ['log', '--reverse', '--format=%H%x1f%s%x1f%b%x1f%cI%x1e'])
    return out
      .split('\x1e')
      .map((record) => record.trim())
      .filter(Boolean)
      .map((record) => {
        const [hash, subject, body, date] = record.split('\x1f')
        return { hash, subject, body: body?.trim() ?? '', date }
      })
  })

  ipcMain.handle(
    'git:commit-changes',
    async (_, root: string, hash: string): Promise<GitFileChange[]> => {
      const out = await git(root, [
        'diff-tree',
        '--no-commit-id',
        '-r',
        '--root',
        '--no-renames',
        '--name-status',
        hash
      ])
      const changes: GitFileChange[] = []
      for (const line of out.split('\n')) {
        const [status, path] = line.split('\t')
        if (!path || !['A', 'M', 'D'].includes(status)) continue
        changes.push({
          status: status as GitFileChange['status'],
          path,
          before: status === 'A' ? null : await gitShow(root, `${hash}^:${path}`),
          after: status === 'D' ? null : await gitShow(root, `${hash}:${path}`)
        })
      }
      return changes
    }
  )

  ipcMain.handle('git:export', async (_, root: string, target: string, steps: GitExportStep[]) => {
    if (fs.existsSync(target) && (await fs.promises.readdir(target)).length > 0) {
      throw new Error('Escolha uma pasta vazia para o repositório.')
    }
    const base = fs.existsSync(snapshotDir(root)) ? snapshotDir(root) : root
    await copyWorkspace(base, target)
    await git(target, ['init', '-q'])
    const identity = await gitIdentityArgs(target)
    const commit = async (message: string): Promise<void> => {
      await git(target, ['add', '-A'])
      await git(target, [...identity, 'commit', '-q', '--allow-empty', '-m', message])
    }
    await commit('Início da aula')
    for (const step of steps) {
      for (const [rel, content] of Object.entries(step.files)) {
        const file = join(target, rel)
        if (relative(target, file).startsWith('..')) continue
        if (content === null) await fs.promises.rm(file, { force: true })
        else {
          await fs.promises.mkdir(dirname(file), { recursive: true })
          await fs.promises.writeFile(file, content, 'utf-8')
        }
      }
      await commit(step.message)
    }
  })

  // --- Dialogs & PDF ---
  ipcMain.handle('dialog:save', async (event, options: SaveDialogOptions) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = win
      ? await dialog.showSaveDialog(win, options)
      : await dialog.showSaveDialog(options)
    return result.canceled ? null : (result.filePath ?? null)
  })

  ipcMain.handle('dialog:open-file', async (event, options: SaveDialogOptions) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const opts = { ...options, properties: ['openFile' as const] }
    const result = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })

  ipcMain.handle('export:pdf', async (_, html: string, path: string) => {
    const tmp = join(os.tmpdir(), `ssc-apostila-${Date.now()}.html`)
    await fs.promises.writeFile(tmp, html, 'utf-8')
    const win = new BrowserWindow({ show: false, webPreferences: { javascript: false } })
    try {
      await win.loadFile(tmp)
      const pdf = await win.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4',
        margins: { top: 0.6, bottom: 0.6, left: 0.6, right: 0.6 }
      })
      await fs.promises.writeFile(path, pdf)
    } finally {
      win.destroy()
      await fs.promises.rm(tmp, { force: true })
    }
  })
}
