import { create } from 'zustand'

export type AnnotatorMode = 'off' | 'pen' | 'spotlight'

interface AnnotatorStore {
  mode: AnnotatorMode
  color: string
  toggle: (mode: Exclude<AnnotatorMode, 'off'>) => void
  close: () => void
  setColor: (color: string) => void
}

export const useAnnotatorStore = create<AnnotatorStore>((set, get) => ({
  mode: 'off',
  color: '#ef4444',
  toggle: (mode) => set({ mode: get().mode === mode ? 'off' : mode }),
  close: () => set({ mode: 'off' }),
  setColor: (color) => set({ color })
}))
