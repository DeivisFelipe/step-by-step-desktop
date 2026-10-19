import { create } from 'zustand'

export interface TerminalSession {
  key: string
  name: string
  /** Shell executable; empty = the first available one. */
  shell?: string
}

interface TerminalStore {
  sessions: TerminalSession[]
  activeKey: string

  add: (name?: string) => string
  remove: (key: string) => void
  rename: (key: string, name: string) => void
  setActive: (key: string) => void
  /** Changes the shell of a terminal (it restarts). */
  setShell: (key: string, shell: string) => void
  /** Finds a terminal by name, creating it when missing. No name = the active one. */
  ensure: (name?: string) => string
}

let counter = 1

export const useTerminalStore = create<TerminalStore>((set, get) => ({
  sessions: [{ key: 't1', name: 'Terminal 1' }],
  activeKey: 't1',

  add: (name) => {
    counter++
    const key = `t${Date.now()}-${counter}`
    const sessions = get().sessions
    const session = { key, name: name?.trim() || `Terminal ${sessions.length + 1}` }
    set({ sessions: [...sessions, session], activeKey: key })
    return key
  },

  remove: (key) => {
    const sessions = get().sessions.filter((s) => s.key !== key)
    if (sessions.length === 0) {
      counter++
      sessions.push({ key: `t${Date.now()}-${counter}`, name: 'Terminal 1' })
    }
    const activeKey = sessions.some((s) => s.key === get().activeKey)
      ? get().activeKey
      : sessions[sessions.length - 1].key
    set({ sessions, activeKey })
  },

  rename: (key, name) =>
    set((state) => ({
      sessions: state.sessions.map((s) => (s.key === key ? { ...s, name } : s))
    })),

  setActive: (activeKey) => set({ activeKey }),
  setShell: (key, shell) =>
    set((state) => ({
      sessions: state.sessions.map((s) => (s.key === key ? { ...s, shell } : s))
    })),

  ensure: (name) => {
    const { sessions, activeKey } = get()
    if (!name?.trim()) return activeKey
    const found = sessions.find((s) => s.name.toLowerCase() === name.trim().toLowerCase())
    return found ? found.key : get().add(name)
  }
}))
