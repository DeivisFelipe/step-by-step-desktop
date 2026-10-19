import { create } from 'zustand'
import { StageChallenge, StageHighlight, StageSlide, StageView } from '../../../shared/presentation'
import { useSettingsStore } from './useSettingsStore'

export interface PathHighlight extends StageHighlight {
  path: string
}

/** What is "on stage": mirrored to the presentation pages and OBS. */
export interface StageSnapshot {
  view: StageView
  slide: StageSlide | null
  challenge: StageChallenge | null
  preview: string | null
  highlight: PathHighlight | null
  terminalKey: string | null
}

interface StageStore extends StageSnapshot {
  /** How the next code change should be animated on the presentation pages. */
  codeTransition: 'typing' | 'morph' | 'none'
  /** Lines to flash in the editor after a morph. */
  flash: { path: string; lines: number[]; key: number } | null

  /** `fromStep` also switches the OBS scene mapped to the view. */
  setView: (view: StageView, fromStep?: boolean) => void
  showSlide: (slide: StageSlide) => void
  showChallenge: (challenge: StageChallenge) => void
  showPreview: (url: string) => void
  setHighlight: (highlight: PathHighlight | null) => void
  setTerminal: (key: string) => void
  setCodeTransition: (transition: StageStore['codeTransition']) => void
  flashLines: (path: string, lines: number[]) => void
  snapshot: () => StageSnapshot
  restore: (snapshot: StageSnapshot) => void
  reset: () => void
}

const EMPTY: StageSnapshot = {
  view: 'code',
  slide: null,
  challenge: null,
  preview: null,
  highlight: null,
  terminalKey: null
}

export const useStageStore = create<StageStore>((set, get) => ({
  ...EMPTY,
  codeTransition: 'typing',
  flash: null,

  setView: (view, fromStep = false) => {
    set({ view })
    if (!fromStep) return
    const { obs } = useSettingsStore.getState().settings
    const scene = obs.enabled ? obs.scenes[view] : undefined
    if (scene) window.api.obsSetScene(scene)
  },
  showSlide: (slide) => {
    set({ slide })
    get().setView('slide', true)
  },
  showChallenge: (challenge) => {
    set({ challenge })
    get().setView('challenge', true)
  },
  showPreview: (preview) => {
    set({ preview })
    get().setView('preview', true)
  },
  setHighlight: (highlight) => set({ highlight }),
  setTerminal: (terminalKey) => set({ terminalKey }),
  setCodeTransition: (codeTransition) => set({ codeTransition }),
  flashLines: (path, lines) => set({ flash: { path, lines, key: Date.now() } }),
  snapshot: () => {
    const { view, slide, challenge, preview, highlight, terminalKey } = get()
    return { view, slide, challenge, preview, highlight, terminalKey }
  },
  restore: (snapshot) => set({ ...snapshot }),
  reset: () => set({ ...EMPTY, codeTransition: 'typing', flash: null })
}))
