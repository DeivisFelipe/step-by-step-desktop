export type NodeType = 'FLOW' | 'STEP'

export interface LessonNode {
  id: string
  parentId: string | null
  type: NodeType
  title: string
  /** Only for FLOW nodes. */
  children?: LessonNode[]
  /** UI state, persisted so the outline reopens the way it was left. */
  isExpanded?: boolean
  /** Only for STEP nodes. */
  data?: StepData
}

export interface StepData {
  /** Private notes, only seen by the presenter. */
  presenterNotes?: string
  /** Public caption (Markdown), shown on the presentation pages. */
  caption?: string
  /** Executed in order when the step runs. */
  actions: StepAction[]
}

export type FileOperation =
  | 'CREATE'
  | 'OVERWRITE'
  | 'APPEND'
  | 'PREPEND'
  | 'REPLACE_TOKEN'
  | 'INSERT_AFTER'
  | 'CURSOR_POSITION'
  | 'DELETE'

/** TYPING types character by character, MORPH animates between versions (magic move). */
export type FileAnimation = 'TYPING' | 'MORPH' | 'NONE'

export interface FileTarget {
  targetMode: 'SPECIFIC_PATH' | 'ACTIVE_FILE'
  /** Relative to the workspace root (absolute paths are accepted too). */
  targetPath?: string
}

export interface FileAction extends FileTarget {
  id: string
  kind: 'FILE'
  operation: FileOperation
  content: string
  /** Text to look for (REPLACE_TOKEN replaces it, INSERT_AFTER types right after it). */
  replaceToken?: string
  config: {
    animation: FileAnimation
    /** Delay between typed characters, default 30. */
    typingSpeedMs?: number
    /** Only used to highlight the content in the step editor. */
    language?: string
  }
}

export interface TerminalAction {
  id: string
  kind: 'TERMINAL'
  command: string
  /** When false the command is only typed into the prompt. */
  executeImmediately: boolean
  typingAnimation?: boolean
  typingSpeedMs?: number
  /** Terminal tab name; created when missing. Empty = the active terminal. */
  terminal?: string
}

/** Waits until some text shows up in a terminal (e.g. "Server ready"). */
export interface WaitAction {
  id: string
  kind: 'WAIT'
  terminal?: string
  pattern: string
  timeoutSec: number
}

export interface SlideAction {
  id: string
  kind: 'SLIDE'
  markdown: string
  /** Image path relative to the workspace, or a URL. */
  image?: string
}

/** Focuses a range of lines of a file, dimming the rest. */
export interface HighlightAction extends FileTarget {
  id: string
  kind: 'HIGHLIGHT'
  startLine: number
  endLine: number
  note?: string
}

export interface ChallengeAction {
  id: string
  kind: 'CHALLENGE'
  markdown: string
  durationSec: number
}

export interface PreviewAction {
  id: string
  kind: 'PREVIEW'
  /** URL or a file path relative to the workspace (served by the local server). */
  url: string
}

export interface ObsSceneAction {
  id: string
  kind: 'OBS_SCENE'
  scene: string
}

export type StepAction =
  | FileAction
  | TerminalAction
  | WaitAction
  | SlideAction
  | HighlightAction
  | ChallengeAction
  | PreviewAction
  | ObsSceneAction

export type ActionKind = StepAction['kind']

export interface LessonFile {
  version: 2
  title?: string
  tree: LessonNode[]
}
