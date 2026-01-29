export type FileSystem = Record<string, FileContent>;

export interface FileContent {
  content: string;
  language: string; // 'javascript', 'typescript', 'python', 'json', etc.
  isOpen: boolean;
}

export type NodeType = 'FLOW' | 'STEP';

export interface LessonNode {
  id: string;
  parentId: string | null;
  type: NodeType;
  title: string;
  children?: LessonNode[]; // Only if type === 'FLOW'
  isExpanded?: boolean;    // UI state
  
  // Payload (Only if type === 'STEP')
  data?: StepData;
}

export interface StepData {
  presenterNotes?: string;
  enableSnapshot: boolean;
  
  action: ActionType;
}

export type ActionType = FileAction | TerminalAction;

export interface FileAction {
  kind: 'FILE';
  targetMode: 'SPECIFIC_PATH' | 'ACTIVE_FILE';
  targetPath?: string; // Required if SPECIFIC_PATH
  
  operation: 'CREATE' | 'OVERWRITE' | 'APPEND' | 'PREPEND' | 'REPLACE_TOKEN' | 'CURSOR_POSITION';
  
  content: string;
  replaceToken?: string; // Used if operation === 'REPLACE_TOKEN'
  
  config: {
    typingAnimation: boolean;
    typingSpeedMs?: number; // default 50
    clearFileFirst?: boolean;
    focusAfter?: boolean;
  };
}

export interface TerminalAction {
  kind: 'TERMINAL';
  command: string;
  executeImmediately: boolean; // if false, just type into prompt
}

export type Snapshots = Record<string, FileSystem>; // Key: stepId -> FileSystem state
