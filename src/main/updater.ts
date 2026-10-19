import { app, ipcMain } from 'electron'
import { autoUpdater, UpdateInfo } from 'electron-updater'
import type { UpdateStatus } from '../shared/ipc'

// Automatic updates from GitHub Releases. New versions are downloaded in the
// background and installed over the old one when the app quits (or right
// away when the user asks). Settings and lessons are never touched.

const CHECK_EVERY_MS = 4 * 60 * 60 * 1000

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

export function setupUpdater(broadcast: (status: UpdateStatus) => void): void {
  const set = (patch: Partial<UpdateStatus>): void => {
    status = { ...status, ...patch }
    broadcast(status)
  }

  ipcMain.handle('updater:status', () => status)
  ipcMain.handle('updater:check', () => check())
  ipcMain.on('updater:install', () => {
    if (status.state === 'ready') autoUpdater.quitAndInstall(false, true)
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
  autoUpdater.logger = null

  autoUpdater.on('checking-for-update', () => set({ state: 'checking', error: null }))
  autoUpdater.on('update-not-available', () => set({ state: 'none' }))
  autoUpdater.on('update-available', (info) =>
    set({ state: 'downloading', version: info.version, percent: 0, notes: notesOf(info) })
  )
  autoUpdater.on('download-progress', (progress) =>
    set({ state: 'downloading', percent: Math.round(progress.percent) })
  )
  autoUpdater.on('update-downloaded', (info) =>
    set({ state: 'ready', version: info.version, percent: 100, notes: notesOf(info) })
  )
  autoUpdater.on('error', (error) =>
    set({ state: 'error', error: error?.message?.split('\n')[0] ?? String(error) })
  )

  setTimeout(check, 8000)
  setInterval(check, CHECK_EVERY_MS)

  async function check(): Promise<UpdateStatus> {
    if (['disabled', 'downloading', 'ready'].includes(status.state)) return status
    try {
      await autoUpdater.checkForUpdates()
    } catch (e) {
      set({ state: 'error', error: (e as Error).message.split('\n')[0] })
    }
    return status
  }
}
