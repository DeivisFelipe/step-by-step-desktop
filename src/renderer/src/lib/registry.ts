import type { editor } from 'monaco-editor'

// Live handles to the main code editor and terminal, so the execution engine
// (which runs outside React) can drive them.

let codeEditor: editor.IStandaloneCodeEditor | null = null
let terminalId: number | null = null

export function setCodeEditor(instance: editor.IStandaloneCodeEditor | null): void {
  codeEditor = instance
}

export function getCodeEditor(): editor.IStandaloneCodeEditor | null {
  return codeEditor
}

export function setTerminalId(id: number | null): void {
  terminalId = id
}

export function getTerminalId(): number | null {
  return terminalId
}

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
