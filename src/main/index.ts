import { app, shell, BrowserWindow, ipcMain, dialog, MessageBoxOptions } from 'electron'
import { join, dirname } from 'path'
import { spawn } from 'child_process'
import * as fs from 'fs'
import os from 'os'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/logo.png?asset'
import type { IPty } from 'node-pty'
import { getSettings, loadSettings, onSettingsChange, savePreset, updateSettings } from './settings'
import { PresentationServer } from './presentationServer'
import { ObsClient } from './obs'
import { setupWorkspaceTools } from './workspaceTools'
import type { PresenterPayload, StagePayload } from '../shared/presentation'

// node-pty is a native module; if it fails to load we fall back to a plain child process.
let pty: typeof import('node-pty') | null = null
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  pty = require('node-pty')
} catch {
  console.warn('node-pty indisponível, usando child_process como fallback')
}

interface TerminalProcess {
  write: (data: string) => void
  resize: (cols: number, rows: number) => void
  kill: () => void
}

const terminals = new Map<number, TerminalProcess>()
let nextTerminalId = 1

let mainWindow: BrowserWindow | null = null
let presenterWindow: BrowserWindow | null = null
let server: PresentationServer
const obs = new ObsClient()

/** Sends to every open window (main and presenter). */
function sendToWindows(channel: string, ...args: unknown[]): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, ...args)
  }
}

function killAllTerminals(): void {
  for (const term of terminals.values()) {
    try {
      term.kill()
    } catch {
      // already dead
    }
  }
  terminals.clear()
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#1e1e1e',
    title: 'Step-by-Step Code',
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.maximize()
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    killAllTerminals()
    presenterWindow?.close()
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.stepbystep.code')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const settings = loadSettings()
  server = new PresentationServer(settings, join(__dirname, '../renderer'), (command) =>
    mainWindow?.webContents.send('remote:command', command)
  )
  server.onInfo((info) => sendToWindows('server:info', info))
  server.start()
  obs.onStatus((status) => sendToWindows('obs:status', status))
  obs.configure(settings.obs)
  onSettingsChange((next) => {
    server.updateSettings(next)
    obs.configure(next.obs)
    sendToWindows('settings:changed', next)
  })

  setupFileSystemHandlers()
  setupDialogHandlers()
  setupTerminalHandlers()
  setupPresentationHandlers()
  setupWorkspaceTools()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  killAllTerminals()
  server?.stop()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

function setupFileSystemHandlers(): void {
  ipcMain.handle('file:open-folder', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Abrir pasta',
      properties: ['openDirectory', 'createDirectory']
    })
    if (canceled || filePaths.length === 0) return null
    return filePaths[0]
  })

  ipcMain.handle('file:read-dir', async (_, path: string) => {
    try {
      const dirents = await fs.promises.readdir(path, { withFileTypes: true })
      return dirents.map((d) => ({
        name: d.name,
        isDirectory: d.isDirectory(),
        path: join(path, d.name)
      }))
    } catch (e) {
      console.error(`[file:read-dir] ${path}:`, e)
      return []
    }
  })

  ipcMain.handle('file:exists', async (_, path: string) => {
    try {
      await fs.promises.access(path)
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('file:read', async (_, path: string) => {
    try {
      return await fs.promises.readFile(path, 'utf-8')
    } catch {
      return null
    }
  })

  ipcMain.handle('file:write', async (_, path: string, content: string) => {
    await fs.promises.mkdir(dirname(path), { recursive: true })
    await fs.promises.writeFile(path, content, 'utf-8')
  })

  ipcMain.handle('file:create-dir', async (_, path: string) => {
    await fs.promises.mkdir(path, { recursive: true })
  })

  ipcMain.handle('file:delete', async (_, path: string) => {
    await fs.promises.rm(path, { recursive: true, force: true })
  })

  ipcMain.handle('file:rename', async (_, oldPath: string, newPath: string) => {
    if (oldPath === newPath) return
    if (fs.existsSync(newPath)) {
      throw new Error(`Já existe um item com esse nome: ${newPath}`)
    }
    await fs.promises.mkdir(dirname(newPath), { recursive: true })
    await fs.promises.rename(oldPath, newPath)
  })

  ipcMain.handle('file:reveal', (_, path: string) => {
    shell.showItemInFolder(path)
  })
}

function setupDialogHandlers(): void {
  ipcMain.handle('dialog:message', async (event, options: MessageBoxOptions) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = win
      ? await dialog.showMessageBox(win, options)
      : await dialog.showMessageBox(options)
    return result.response
  })
}

function listShells(): string[] {
  if (os.platform() === 'win32') {
    const systemRoot = process.env.SystemRoot || 'C:\\Windows'
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files'
    const candidates = [
      join(programFiles, 'PowerShell', '7', 'pwsh.exe'),
      join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
      join(systemRoot, 'System32', 'cmd.exe'),
      join(programFiles, 'Git', 'bin', 'bash.exe'),
      join(systemRoot, 'System32', 'wsl.exe')
    ]
    return candidates.filter((s) => fs.existsSync(s))
  }
  const candidates = [process.env.SHELL, '/bin/zsh', '/bin/bash', '/bin/sh'].filter(
    (s): s is string => !!s
  )
  return [...new Set(candidates)].filter((s) => fs.existsSync(s))
}

function spawnTerminal(
  shellPath: string,
  cwd: string,
  onData: (data: string) => void,
  onExit: (code: number | null) => void
): TerminalProcess {
  const env = { ...process.env } as Record<string, string>

  if (pty) {
    const proc: IPty = pty.spawn(shellPath, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd,
      env
    })
    proc.onData(onData)
    proc.onExit(({ exitCode }) => onExit(exitCode))
    return {
      write: (data) => proc.write(data),
      resize: (cols, rows) => proc.resize(Math.max(cols, 1), Math.max(rows, 1)),
      kill: () => proc.kill()
    }
  }

  const cp = spawn(shellPath, [], { cwd, env })
  cp.stdout?.on('data', (data: Buffer) => onData(data.toString()))
  cp.stderr?.on('data', (data: Buffer) => onData(data.toString()))
  cp.on('exit', (code) => onExit(code))
  cp.on('error', (err) => onData(`\r\n${err.message}\r\n`))
  return {
    // Without a pty there is no line discipline: echo the input and translate Enter.
    write: (data) => {
      onData(data.replace(/\r/g, '\r\n'))
      cp.stdin?.write(data.replace(/\r/g, '\n'))
    },
    resize: () => {},
    kill: () => cp.kill()
  }
}

function setupTerminalHandlers(): void {
  ipcMain.handle('terminal:get-shells', () => listShells())

  ipcMain.handle('terminal:create', (event, options?: { shell?: string; cwd?: string }) => {
    const shellPath =
      options?.shell ||
      listShells()[0] ||
      (os.platform() === 'win32' ? 'powershell.exe' : '/bin/sh')
    const cwd = options?.cwd && fs.existsSync(options.cwd) ? options.cwd : os.homedir()
    const id = nextTerminalId++
    const sender = event.sender

    const send = (channel: string, ...args: unknown[]): void => {
      if (!sender.isDestroyed()) sender.send(channel, ...args)
    }

    try {
      const term = spawnTerminal(
        shellPath,
        cwd,
        (data) => {
          send('terminal:data', id, data)
          server.terminalData(id, data)
        },
        (code) => {
          terminals.delete(id)
          server.terminalClosed(id)
          send('terminal:exit', id, code)
        }
      )
      terminals.set(id, term)
    } catch (e) {
      setTimeout(() => {
        send('terminal:data', id, `\r\nFalha ao iniciar ${shellPath}: ${(e as Error).message}\r\n`)
      }, 50)
    }
    return id
  })

  ipcMain.on('terminal:input', (_, id: number, data: string) => {
    terminals.get(id)?.write(data)
  })

  ipcMain.on('terminal:resize', (_, id: number, cols: number, rows: number) => {
    server.terminalResized(id, cols, rows)
    try {
      terminals.get(id)?.resize(cols, rows)
    } catch {
      // the process may have exited between the resize and this call
    }
  })

  ipcMain.on('terminal:kill', (_, id: number) => {
    const term = terminals.get(id)
    if (!term) return
    terminals.delete(id)
    server.terminalClosed(id)
    try {
      term.kill()
    } catch {
      // already dead
    }
  })
}

function openPresenterWindow(): void {
  if (presenterWindow && !presenterWindow.isDestroyed()) {
    presenterWindow.focus()
    return
  }
  const info = server.info()
  if (!info.port) return
  presenterWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    title: 'Visão do apresentador',
    autoHideMenuBar: true,
    backgroundColor: '#111827',
    icon
  })
  presenterWindow.on('closed', () => (presenterWindow = null))
  presenterWindow.loadURL(`${info.localUrl}/apresentador?token=${info.token}`)
}

function setupPresentationHandlers(): void {
  ipcMain.handle('settings:get', () => getSettings())
  ipcMain.handle('settings:update', (_, patch: unknown) => updateSettings(patch))
  ipcMain.handle('settings:save-preset', (_, name: string, style) => savePreset(name, style))

  ipcMain.handle('server:info', () => server.info())
  ipcMain.on('stage:publish', (_, payload: StagePayload) => server.publishStage(payload))
  ipcMain.on('presenter:publish', (_, payload: PresenterPayload) =>
    server.publishPresenter(payload)
  )
  ipcMain.on('presenter:open', () => openPresenterWindow())
  ipcMain.on('workspace:set-root', (_, root: string | null) => server.setWorkspace(root))

  ipcMain.handle('obs:status', () => obs.status)
  ipcMain.on('obs:set-scene', (_, scene: string) => obs.setScene(scene))
  ipcMain.on('obs:chapter', (_, title: string) => obs.chapter(title))
}
