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
  presenterNotes?: string
  action: ActionType
}

export type ActionType = FileAction | TerminalAction

export type FileOperation =
  | 'CREATE'
  | 'OVERWRITE'
  | 'APPEND'
  | 'PREPEND'
  | 'REPLACE_TOKEN'
  | 'CURSOR_POSITION'

export interface FileAction {
  kind: 'FILE'
  targetMode: 'SPECIFIC_PATH' | 'ACTIVE_FILE'
  /** Relative to the workspace root (absolute paths are accepted too). */
  targetPath?: string
  operation: FileOperation
  content: string
  /** Text to look for when operation === 'REPLACE_TOKEN'. */
  replaceToken?: string
  config: {
    typingAnimation: boolean
    /** Delay between typed characters, default 30. */
    typingSpeedMs?: number
    /** Only used to highlight the content in the step editor. */
    language?: string
  }
}

export interface TerminalAction {
  kind: 'TERMINAL'
  command: string
  /** When false the command is only typed into the prompt. */
  executeImmediately: boolean
  typingAnimation?: boolean
  typingSpeedMs?: number
}

export interface LessonFile {
  version: 1
  tree: LessonNode[]
}
