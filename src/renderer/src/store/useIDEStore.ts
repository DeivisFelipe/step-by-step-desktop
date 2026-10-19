import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { basename, isInside, replacePrefix } from '../lib/paths'
import { useFileSystemStore } from './useFileSystemStore'

export type ActivityBarItem = 'EXPLORER' | 'STEPS' | 'PRESENT'

export type SpecialTabType =
  | 'SLIDE'
  | 'CHALLENGE'
  | 'PREVIEW'
  | 'SETTINGS'
  | 'REHEARSAL'
  | 'GIT_IMPORT'

export interface Tab {
  /** File path for FILE tabs, node id for STEP/FLOW tabs, a fixed id for the others. */
  id: string
  type: 'FILE' | 'STEP' | 'FLOW' | SpecialTabType
}

/** Tabs that exist at most once. */
export const SPECIAL_TAB_IDS: Record<SpecialTabType, string> = {
  SLIDE: 'tab:slide',
  CHALLENGE: 'tab:challenge',
  PREVIEW: 'tab:preview',
  SETTINGS: 'tab:settings',
  REHEARSAL: 'tab:rehearsal',
  GIT_IMPORT: 'tab:git-import'
}

export interface Toast {
  id: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
}

export interface TextPrompt {
  title: string
  initialValue: string
  placeholder?: string
  resolve: (value: string | null) => void
}

interface IDEStore {
  activeActivity: ActivityBarItem
  sidebarVisible: boolean
  sidebarWidth: number
  terminalVisible: boolean
  terminalHeight: number

  tabs: Tab[]
  activeTabId: string | null
  /** Last file tab that was active; "active file" steps still target it when a slide is shown. */
  lastFilePath: string | null
  toasts: Toast[]
  prompt: TextPrompt | null

  setActiveActivity: (item: ActivityBarItem) => void
  toggleSidebar: () => void
  setSidebarWidth: (width: number) => void
  setTerminalVisible: (visible: boolean) => void
  setTerminalHeight: (height: number) => void

  openFileTab: (path: string) => void
  openNodeTab: (id: string, type: 'STEP' | 'FLOW') => void
  openSpecialTab: (type: SpecialTabType) => void
  setActiveTab: (id: string) => void
  /** Asks to save unsaved changes first. Resolves to false if the user cancelled. */
  closeTab: (id: string) => Promise<boolean>
  closeTabsUnder: (path: string) => void
  closeNodeTabs: (ids: string[]) => void
  closeAllTabs: () => void
  renamePath: (oldPath: string, newPath: string) => void
  /** Path of the file in the active tab, or of the last active file tab still open. */
  activeFilePath: () => string | null

  notify: (message: string, type?: Toast['type'], duration?: number) => void
  dismissToast: (id: string) => void
  askText: (title: string, initialValue?: string, placeholder?: string) => Promise<string | null>
  resolvePrompt: (value: string | null) => void
}

function nextActiveAfterClose(tabs: Tab[], closedIndex: number): string | null {
  if (tabs.length === 0) return null
  return tabs[Math.min(closedIndex, tabs.length - 1)].id
}

export const useIDEStore = create<IDEStore>()(
  persist(
    (set, get) => ({
      activeActivity: 'EXPLORER',
      sidebarVisible: true,
      sidebarWidth: 280,
      terminalVisible: true,
      terminalHeight: 220,

      tabs: [],
      activeTabId: null,
      lastFilePath: null,
      toasts: [],
      prompt: null,

      setActiveActivity: (item) => {
        const { activeActivity, sidebarVisible } = get()
        // Clicking the active icon again hides the sidebar, like VS Code.
        if (item === activeActivity && sidebarVisible) set({ sidebarVisible: false })
        else set({ activeActivity: item, sidebarVisible: true })
      },
      toggleSidebar: () => set((s) => ({ sidebarVisible: !s.sidebarVisible })),
      setSidebarWidth: (width) => set({ sidebarWidth: Math.min(Math.max(width, 180), 600) }),
      setTerminalVisible: (visible) => set({ terminalVisible: visible }),
      setTerminalHeight: (height) => set({ terminalHeight: Math.min(Math.max(height, 80), 800) }),

      openFileTab: (path) => {
        const { tabs } = get()
        if (!tabs.some((t) => t.id === path)) set({ tabs: [...tabs, { id: path, type: 'FILE' }] })
        set({ activeTabId: path, lastFilePath: path })
        useFileSystemStore.getState().loadFile(path)
      },

      openNodeTab: (id, type) => {
        const { tabs } = get()
        if (!tabs.some((t) => t.id === id)) set({ tabs: [...tabs, { id, type }] })
        set({ activeTabId: id })
      },

      openSpecialTab: (type) => {
        const id = SPECIAL_TAB_IDS[type]
        const { tabs } = get()
        if (!tabs.some((t) => t.id === id)) set({ tabs: [...tabs, { id, type }] })
        set({ activeTabId: id })
      },

      setActiveTab: (id) => {
        const tab = get().tabs.find((t) => t.id === id)
        set(tab?.type === 'FILE' ? { activeTabId: id, lastFilePath: id } : { activeTabId: id })
      },

      closeTab: async (id) => {
        const tab = get().tabs.find((t) => t.id === id)
        if (!tab) return true

        if (tab.type === 'FILE') {
          const fs = useFileSystemStore.getState()
          const file = fs.files[id]
          if (file && file.content !== file.savedContent) {
            const choice = await window.api.showMessage({
              type: 'warning',
              message: `Salvar as alterações em ${basename(id)}?`,
              detail: 'Suas alterações serão perdidas se você não salvá-las.',
              buttons: ['Salvar', 'Não salvar', 'Cancelar'],
              defaultId: 0,
              cancelId: 2
            })
            if (choice === 2) return false
            if (choice === 0) await fs.saveFile(id)
          }
          fs.forgetFile(id)
        }

        set((state) => {
          const index = state.tabs.findIndex((t) => t.id === id)
          const tabs = state.tabs.filter((t) => t.id !== id)
          const activeTabId =
            state.activeTabId === id ? nextActiveAfterClose(tabs, index) : state.activeTabId
          return { tabs, activeTabId }
        })
        return true
      },

      closeTabsUnder: (path) => {
        set((state) => {
          const tabs = state.tabs.filter((t) => t.type !== 'FILE' || !isInside(t.id, path))
          const activeTabId = tabs.some((t) => t.id === state.activeTabId)
            ? state.activeTabId
            : (tabs[tabs.length - 1]?.id ?? null)
          return { tabs, activeTabId }
        })
      },

      closeNodeTabs: (ids) => {
        const remove = new Set(ids)
        set((state) => {
          const tabs = state.tabs.filter((t) => !remove.has(t.id) || t.type === 'FILE')
          const activeTabId = tabs.some((t) => t.id === state.activeTabId)
            ? state.activeTabId
            : (tabs[tabs.length - 1]?.id ?? null)
          return { tabs, activeTabId }
        })
      },

      closeAllTabs: () => set({ tabs: [], activeTabId: null }),

      renamePath: (oldPath, newPath) => {
        const move = (p: string): string =>
          isInside(p, oldPath) ? replacePrefix(p, oldPath, newPath) : p
        set((state) => ({
          tabs: state.tabs.map((t) => (t.type === 'FILE' ? { ...t, id: move(t.id) } : t)),
          activeTabId: state.activeTabId ? move(state.activeTabId) : null,
          lastFilePath: state.lastFilePath ? move(state.lastFilePath) : null
        }))
      },

      activeFilePath: () => {
        const { tabs, activeTabId, lastFilePath } = get()
        const tab = tabs.find((t) => t.id === activeTabId)
        if (tab?.type === 'FILE') return tab.id
        return lastFilePath && tabs.some((t) => t.id === lastFilePath) ? lastFilePath : null
      },

      notify: (message, type = 'info', duration = 4000) => {
        const id = crypto.randomUUID()
        set((state) => ({ toasts: [...state.toasts.slice(-4), { id, message, type }] }))
        if (duration > 0) setTimeout(() => get().dismissToast(id), duration)
      },

      dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

      askText: (title, initialValue = '', placeholder) =>
        new Promise((resolve) => {
          get().prompt?.resolve(null)
          set({ prompt: { title, initialValue, placeholder, resolve } })
        }),

      resolvePrompt: (value) => {
        const prompt = get().prompt
        set({ prompt: null })
        prompt?.resolve(value)
      }
    }),
    {
      name: 'ssc-layout',
      partialize: (s) => ({
        activeActivity: s.activeActivity,
        sidebarVisible: s.sidebarVisible,
        sidebarWidth: s.sidebarWidth,
        terminalVisible: s.terminalVisible,
        terminalHeight: s.terminalHeight
      })
    }
  )
)

/** Shows an error from a failed operation as a toast. */
export function reportError(error: unknown, prefix?: string): void {
  const message = error instanceof Error ? error.message : String(error)
  // Electron prefixes errors thrown in IPC handlers with this noise.
  const clean = message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
  useIDEStore.getState().notify(prefix ? `${prefix}: ${clean}` : clean, 'error', 6000)
}
