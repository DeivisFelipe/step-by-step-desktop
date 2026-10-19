// Types shared by the main process, the IDE and the presentation pages (OBS overlays).

export type StageView = 'code' | 'terminal' | 'slide' | 'challenge' | 'preview'

export interface StageHighlight {
  startLine: number
  endLine: number
  note?: string
}

export interface StageCode {
  /** Path relative to the workspace (used as the window title). */
  path: string
  language: string
  content: string
  highlight: StageHighlight | null
  /** 1-based line of the cursor, kept in view while typing. */
  cursorLine: number
  /** How the latest change should be shown: typed in place or morphed (magic move). */
  transition: 'typing' | 'morph' | 'none'
  /** Increments on every change. */
  version: number
}

export interface StageSlide {
  markdown: string
  /** URL already resolved by the IDE (workspace files go through the local server). */
  image?: string
}

export interface StageChallenge {
  markdown: string
  durationSec: number
  /** Epoch ms when the countdown ends (server clock). */
  endsAt: number
}

/** Public state of the presentation: safe to show to students. */
export interface StagePayload {
  lessonTitle: string
  flowTitle: string
  stepTitle: string
  stepNumber: number
  stepTotal: number
  view: StageView
  code: StageCode | null
  /** pty id whose output is on stage. */
  terminalId: number | null
  terminalName: string
  slide: StageSlide | null
  challenge: StageChallenge | null
  preview: string | null
  /** Public caption of the current step (Markdown). */
  caption: string
  running: boolean
}

export interface PresenterStep {
  id: string
  title: string
  flowTitle: string
  number: number
  executed: boolean
  notes: string
  caption: string
}

/** Private state for the presenter view (requires the token). */
export interface PresenterPayload {
  steps: PresenterStep[]
  currentId: string | null
  nextId: string | null
  runningId: string | null
  sessionStartedAt: number | null
  stepStartedAt: number | null
}

export type RemoteCommand =
  | { command: 'next' }
  | { command: 'prev' }
  | { command: 'skip' }
  | { command: 'goto'; stepId: string }

// --- Settings -----------------------------------------------------------------

export type Aspect = '16:9' | '4:3' | '9:16' | '1:1' | 'livre'

export interface PresentationStyle {
  aspect: Aspect
  /** CSS background of the page around the window. */
  background: string
  /** Transparent page background (for OBS). Overrides `background`. */
  transparent: boolean
  padding: number
  chrome: 'mac' | 'windows' | 'none'
  /** Shiki theme. */
  theme: string
  fontSize: number
  fontFamily: string
  lineNumbers: boolean
  shadow: boolean
  radius: number
  showTitle: boolean
  /** Caption inside the stage page. */
  captionPosition: 'bottom' | 'top' | 'none'
  captionSize: number
  /** Duration of the magic-move animation, ms. */
  morphDuration: number
}

export interface ObsSettings {
  enabled: boolean
  host: string
  port: number
  password: string
  /** Adds a chapter marker to the recording at each step (OBS 30.2+, Hybrid MP4). */
  chapters: boolean
  scenes: Partial<Record<StageView, string>>
}

export interface AppSettings {
  server: {
    port: number
    /** Listen on the local network so students can follow along. */
    shareOnLan: boolean
    token: string
  }
  presentation: {
    preset: string
    presets: Record<string, PresentationStyle>
  }
  obs: ObsSettings
  keys: {
    /** PageDown/PageUp (presentation clickers) advance and go back. */
    clicker: boolean
  }
  projector: boolean
}

export const BUILTIN_PRESETS: Record<string, PresentationStyle> = {
  Carbon: {
    aspect: '16:9',
    background: 'linear-gradient(135deg, #4f46e5 0%, #9333ea 50%, #db2777 100%)',
    transparent: false,
    padding: 64,
    chrome: 'mac',
    theme: 'one-dark-pro',
    fontSize: 26,
    fontFamily: "'JetBrains Mono', 'Cascadia Code', Consolas, monospace",
    lineNumbers: true,
    shadow: true,
    radius: 14,
    showTitle: true,
    captionPosition: 'bottom',
    captionSize: 28,
    morphDuration: 800
  },
  Oceano: {
    aspect: '16:9',
    background: 'linear-gradient(140deg, #0ea5e9 0%, #0f766e 100%)',
    transparent: false,
    padding: 64,
    chrome: 'mac',
    theme: 'github-dark',
    fontSize: 26,
    fontFamily: "'JetBrains Mono', 'Cascadia Code', Consolas, monospace",
    lineNumbers: true,
    shadow: true,
    radius: 14,
    showTitle: true,
    captionPosition: 'bottom',
    captionSize: 28,
    morphDuration: 800
  },
  Claro: {
    aspect: '16:9',
    background: 'linear-gradient(135deg, #e0e7ff 0%, #fce7f3 100%)',
    transparent: false,
    padding: 64,
    chrome: 'mac',
    theme: 'github-light',
    fontSize: 26,
    fontFamily: "'JetBrains Mono', 'Cascadia Code', Consolas, monospace",
    lineNumbers: true,
    shadow: true,
    radius: 14,
    showTitle: true,
    captionPosition: 'bottom',
    captionSize: 28,
    morphDuration: 800
  },
  'Transparente (OBS)': {
    aspect: 'livre',
    background: 'transparent',
    transparent: true,
    padding: 24,
    chrome: 'mac',
    theme: 'one-dark-pro',
    fontSize: 26,
    fontFamily: "'JetBrains Mono', 'Cascadia Code', Consolas, monospace",
    lineNumbers: true,
    shadow: false,
    radius: 12,
    showTitle: true,
    captionPosition: 'none',
    captionSize: 28,
    morphDuration: 800
  },
  Vertical: {
    aspect: '9:16',
    background: 'linear-gradient(180deg, #111827 0%, #312e81 100%)',
    transparent: false,
    padding: 40,
    chrome: 'mac',
    theme: 'dracula',
    fontSize: 30,
    fontFamily: "'JetBrains Mono', 'Cascadia Code', Consolas, monospace",
    lineNumbers: false,
    shadow: true,
    radius: 16,
    showTitle: true,
    captionPosition: 'bottom',
    captionSize: 34,
    morphDuration: 800
  }
}

export const SHIKI_THEMES = [
  'one-dark-pro',
  'github-dark',
  'github-light',
  'dracula',
  'nord',
  'monokai',
  'vitesse-dark',
  'vitesse-light',
  'min-light',
  'catppuccin-mocha'
]

export const DEFAULT_SETTINGS: AppSettings = {
  server: { port: 4545, shareOnLan: false, token: '' },
  presentation: { preset: 'Carbon', presets: BUILTIN_PRESETS },
  obs: {
    enabled: false,
    host: '127.0.0.1',
    port: 4455,
    password: '',
    chapters: true,
    scenes: {}
  },
  keys: { clicker: true },
  projector: false
}

/** Paths served by the presentation server and their purpose. */
export const PRESENTATION_PAGES = [
  {
    path: 'palco',
    label: 'Palco',
    hint: 'Mostra automaticamente código, terminal, slide ou desafio'
  },
  { path: 'codigo', label: 'Código', hint: 'Somente a janela de código' },
  { path: 'terminal', label: 'Terminal', hint: 'Somente o terminal' },
  { path: 'slide', label: 'Slide', hint: 'Slides e desafios' },
  { path: 'legenda', label: 'Legenda', hint: 'Legenda do passo, fundo transparente' },
  { path: 'progresso', label: 'Progresso', hint: 'Barra com o passo atual, fundo transparente' }
] as const

export function resolveStyle(settings: AppSettings, presetName?: string | null): PresentationStyle {
  const name =
    presetName && settings.presentation.presets[presetName]
      ? presetName
      : settings.presentation.preset
  return settings.presentation.presets[name] ?? BUILTIN_PRESETS[name] ?? BUILTIN_PRESETS.Carbon
}
