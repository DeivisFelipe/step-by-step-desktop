import { create } from 'zustand'
import { AppSettings, DEFAULT_SETTINGS } from '../../../shared/presentation'
import { ObsStatus, ServerInfo, UpdateStatus } from '../../../shared/ipc'
import type { DeepPartial } from '../../../preload/index.d'
import { reportError, useIDEStore } from './useIDEStore'

interface SettingsStore {
  settings: AppSettings
  server: ServerInfo | null
  obs: ObsStatus | null
  updater: UpdateStatus | null
  update: (partial: DeepPartial<AppSettings>) => Promise<void>
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: DEFAULT_SETTINGS,
  server: null,
  obs: null,
  updater: null,
  update: async (partial) => {
    try {
      set({ settings: await window.api.updateSettings(partial) })
    } catch (e) {
      reportError(e, 'Não foi possível salvar as configurações')
    }
  }
}))

/** Loads settings and keeps them (and server/OBS status) in sync with the main process. */
export function initSettings(): void {
  window.api.getSettings().then((settings) => useSettingsStore.setState({ settings }))
  window.api.getServerInfo().then((server) => useSettingsStore.setState({ server }))
  window.api.obsStatus().then((obs) => useSettingsStore.setState({ obs }))
  window.api.onSettingsChanged((settings) => useSettingsStore.setState({ settings }))
  window.api.onServerInfo((server) => useSettingsStore.setState({ server }))
  window.api.onObsStatus((obs) => useSettingsStore.setState({ obs }))
  window.api.getUpdateStatus().then((updater) => useSettingsStore.setState({ updater }))
  window.api.onUpdateStatus((updater) => {
    const previous = useSettingsStore.getState().updater
    useSettingsStore.setState({ updater })
    if (updater.state === 'ready' && previous?.state !== 'ready') {
      useIDEStore
        .getState()
        .notify(
          `A versão ${updater.version} foi baixada. Ela será instalada ao fechar o app (ou clique na barra de status).`,
          'success',
          10000
        )
    }
  })
}

/** URL of a workspace file through the local server (for slide images and previews). */
export function workspaceFileUrl(relativePath: string): string | null {
  const server = useSettingsStore.getState().server
  if (!server) return null
  const clean = relativePath.replace(/\\/g, '/').replace(/^\.?\//, '')
  return `${server.localUrl}/arquivos/${clean.split('/').map(encodeURIComponent).join('/')}`
}
