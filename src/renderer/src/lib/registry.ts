import type { editor } from 'monaco-editor'

// Live handles to the main code editor and the terminals, so the execution
// engine (which runs outside React) can drive them.

let codeEditor: editor.IStandaloneCodeEditor | null = null
const terminalIds = new Map<string, number>()
/** Output received since the last command sent to each pty (for "wait" actions). */
const recentOutput = new Map<number, string>()
const MAX_RECENT_OUTPUT = 64 * 1024

export function setCodeEditor(instance: editor.IStandaloneCodeEditor | null): void {
  codeEditor = instance
}

export function getCodeEditor(): editor.IStandaloneCodeEditor | null {
  return codeEditor
}

export function setTerminalId(key: string, id: number | null): void {
  if (id === null) terminalIds.delete(key)
  else terminalIds.set(key, id)
}

export function getTerminalId(key: string): number | null {
  return terminalIds.get(key) ?? null
}

export function appendTerminalOutput(id: number, data: string): void {
  const text = (recentOutput.get(id) ?? '') + data
  recentOutput.set(id, text.length > MAX_RECENT_OUTPUT ? text.slice(-MAX_RECENT_OUTPUT) : text)
}

export function markTerminalOutput(id: number): void {
  recentOutput.set(id, '')
}

/** Output since the last mark, without ANSI escape sequences. */
export function terminalOutputSinceMark(id: number): string {
  // eslint-disable-next-line no-control-regex
  return (recentOutput.get(id) ?? '').replace(/\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07]*\x07/g, '')
}

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
