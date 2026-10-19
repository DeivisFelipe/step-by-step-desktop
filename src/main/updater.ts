import { app, ipcMain, shell } from 'electron'
import { autoUpdater, UpdateInfo } from 'electron-updater'
import { join } from 'path'
import * as fs from 'fs'
import type { UpdateStatus } from '../shared/ipc'

// Automatic updates from GitHub Releases. New versions are downloaded in the
// background and installed over the old one when the app quits (or right
// away when the user asks). Settings and lessons are never touched.

/** Periodic check while the app stays open. */
const CHECK_EVERY_MS = 30 * 60 * 1000
/** Coming back to the window checks again if the last check is older than this. */
const CHECK_ON_FOCUS_AFTER_MS = 10 * 60 * 1000

let status: UpdateStatus = {
  current: app.getVersion(),
  state: 'idle',
  version: null,
  percent: 0,
  error: null,
  notes: null
}

function notesOf(info: UpdateInfo): string | null {
  const notes = info.releaseNotes
  if (!notes) return null
  if (typeof notes === 'string') return notes
  return notes.map((n) => n.note ?? '').join('\n\n')
}

function logPath(): string {
  return join(app.getPath('logs'), 'atualizacoes.log')
}

/** Small log of update checks, for diagnosing "the update never showed up". */
function log(message: string): void {
  try {
    const file = logPath()
    fs.mkdirSync(join(file, '..'), { recursive: true })
    if (fs.existsSync(file) && fs.statSync(file).size > 256 * 1024) {
      fs.renameSync(file, `${file}.old`)
    }
    fs.appendFileSync(file, `${new Date().toISOString()} ${message}\n`)
  } catch {
    // logging must never break the app
  }
}

export function setupUpdater(broadcast: (status: UpdateStatus) => void): void {
  let lastCheck = 0

  const set = (patch: Partial<UpdateStatus>): void => {
    status = { ...status, ...patch }
    broadcast(status)
  }

  ipcMain.handle('updater:status', () => status)
  ipcMain.handle('updater:check', () => check('manual'))
  ipcMain.on('updater:install', () => {
    if (status.state !== 'ready') return
    log(`instalando ${status.version} a pedido do usuário`)
    autoUpdater.quitAndInstall(false, true)
  })
  ipcMain.on('updater:open-log', () => {
    if (!fs.existsSync(logPath())) log('registro criado')
    shell.openPath(logPath())
  })

  // A test feed (SSC_UPDATE_URL) can point a build at a local server.
  const testFeed = process.env['SSC_UPDATE_URL']
  if (!app.isPackaged && !testFeed) {
    status = { ...status, state: 'disabled' }
    return
  }
  if (testFeed) {
    autoUpdater.forceDevUpdateConfig = !app.isPackaged
    autoUpdater.setFeedURL({ provider: 'generic', url: testFeed })
  }

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.disableWebInstaller = true
  autoUpdater.logger = {
    info: (m?: unknown) => log(`info ${String(m)}`),
    warn: (m?: unknown) => log(`aviso ${String(m)}`),
    error: (m?: unknown) => log(`erro ${String(m)}`),
    debug: () => {}
  }

  autoUpdater.on('checking-for-update', () => set({ state: 'checking', error: null }))
  autoUpdater.on('update-not-available', (info) => {
    log(`nenhuma atualização (mais recente: ${info.version})`)
    set({ state: 'none' })
  })
  autoUpdater.on('update-available', (info) => {
    log(`versão ${info.version} disponível, baixando`)
    set({ state: 'downloading', version: info.version, percent: 0, notes: notesOf(info) })
  })
  autoUpdater.on('download-progress', (progress) =>
    set({ state: 'downloading', percent: Math.round(progress.percent) })
  )
  autoUpdater.on('update-downloaded', (info) => {
    log(`versão ${info.version} baixada, pronta para instalar`)
    set({ state: 'ready', version: info.version, percent: 100, notes: notesOf(info) })
  })
  autoUpdater.on('error', (error) => {
    const message = error?.message?.split('\n')[0] ?? String(error)
    log(`erro: ${message}`)
    set({ state: 'error', error: message })
  })

  setTimeout(() => check('ao abrir'), 8000)
  setInterval(() => check('periódica'), CHECK_EVERY_MS)
  app.on('browser-window-focus', () => {
    if (Date.now() - lastCheck > CHECK_ON_FOCUS_AFTER_MS) check('janela em foco')
  })

  async function check(reason: string): Promise<UpdateStatus> {
    if (['disabled', 'downloading', 'ready'].includes(status.state)) return status
    lastCheck = Date.now()
    log(`verificando (${reason}), versão instalada ${status.current}`)
    try {
      await autoUpdater.checkForUpdates()
    } catch (e) {
      const message = (e as Error).message.split('\n')[0]
      log(`erro ao verificar: ${message}`)
      set({ state: 'error', error: message })
    }
    return status
  }
}
