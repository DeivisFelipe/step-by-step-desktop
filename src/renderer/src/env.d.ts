export interface IElectronAPI {
  loadPreferences: () => Promise<void>
}

export interface IAPI {
  openFolder: () => Promise<string | null>;
  readDir: (path: string) => Promise<Array<{ name: string; isDirectory: boolean; path: string }>>;
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
  createDir: (path: string) => Promise<void>;
  delete: (path: string) => Promise<void>;
  rename: (oldPath: string, newPath: string) => Promise<void>;
  
  createTerminal: (options?: { shell?: string; cwd?: string }) => void;
  onTerminalData: (callback: (data: string) => void) => () => void;
  sendTerminalInput: (data: string) => void;
  resizeTerminal: (cols: number, rows: number) => void;
  getAvailableShells: () => Promise<string[]>;
}

declare global {
  interface Window {
    electron: IElectronAPI
    api: IAPI
  }
}
