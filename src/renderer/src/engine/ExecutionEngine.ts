import type { editor as MonacoEditor } from 'monaco-editor'
import { FileAction, LessonNode, TerminalAction } from '../types/schema'
import { useFileSystemStore } from '../store/useFileSystemStore'
import { useIDEStore } from '../store/useIDEStore'
import { resolvePlaceholders } from '../lib/tree'
import { relativeTo, resolveInWorkspace } from '../lib/paths'
import { getCodeEditor, getTerminalId, sleep } from '../lib/registry'
import { modelPathFor, monaco } from '../lib/monaco'

/** What a step changed on disk, so it can be undone. `before === null` means the file was created. */
export interface FileChange {
  path: string
  before: string | null
}

/** An error meant to be shown to the presenter as is. */
export class StepError extends Error {}

const DEFAULT_FILE_TYPING_MS = 30
const DEFAULT_TERMINAL_TYPING_MS = 35

let skipRequested = false

/** Finishes the running typing animation immediately. */
export function skipAnimation(): void {
  skipRequested = true
}

export async function executeStep(step: LessonNode): Promise<FileChange[]> {
  if (step.type !== 'STEP' || !step.data) return []
  skipRequested = false
  const { action } = step.data
  if (action.kind === 'FILE') return runFileAction(action)
  await runTerminalAction(action)
  return []
}

/** Restores the files touched by a step. */
export async function revertChanges(changes: FileChange[]): Promise<void> {
  const fs = useFileSystemStore.getState()
  for (const change of [...changes].reverse()) {
    if (change.before === null) {
      await fs.deleteNode(change.path)
    } else {
      await fs.writeFile(change.path, change.before)
    }
  }
  await useFileSystemStore.getState().refreshTree()
}

// --- File actions ------------------------------------------------------------

function resolveTarget(action: FileAction): string {
  const { rootPath } = useFileSystemStore.getState()
  const usesPath = action.operation === 'CREATE' || action.targetMode === 'SPECIFIC_PATH'
  if (!usesPath) {
    const active = useIDEStore.getState().activeFilePath()
    if (!active) {
      throw new StepError(
        'Este passo usa o arquivo ativo, mas nenhum arquivo está aberto no editor.'
      )
    }
    return active
  }
  if (!action.targetPath?.trim()) throw new StepError('Informe o caminho do arquivo deste passo.')
  const path = resolveInWorkspace(rootPath, action.targetPath)
  if (!path) throw new StepError('Abra uma pasta para usar caminhos relativos.')
  return path
}

/** Plain string version of each operation (used when there is no animation). */
function applyOperation(current: string, action: FileAction, text: string): string {
  switch (action.operation) {
    case 'CREATE':
    case 'OVERWRITE':
      return text
    case 'PREPEND':
      return text + (current && !text.endsWith('\n') ? '\n' : '') + current
    case 'REPLACE_TOKEN': {
      const token = action.replaceToken ?? ''
      if (!token || !current.includes(token)) {
        throw new StepError(`O texto "${token}" não foi encontrado no arquivo.`)
      }
      return current.replace(token, () => text)
    }
    case 'APPEND':
    case 'CURSOR_POSITION':
    default:
      return current + (current && !current.endsWith('\n') ? '\n' : '') + text
  }
}

async function runFileAction(action: FileAction): Promise<FileChange[]> {
  const path = resolveTarget(action)
  const fs = useFileSystemStore.getState()

  const existed = await window.api.exists(path)
  let before: string | null = null
  if (existed) {
    const cached = useFileSystemStore.getState().files[path]
    // Re-read from disk unless the presenter has unsaved edits in the editor.
    if (!cached || cached.content === cached.savedContent) {
      if (!(await fs.loadFile(path, true))) throw new StepError(`Não foi possível ler ${path}.`)
    }
    before = useFileSystemStore.getState().files[path].content
  } else {
    if (action.operation !== 'CREATE' && action.targetMode === 'ACTIVE_FILE') {
      throw new StepError('O arquivo ativo não existe mais no disco.')
    }
    await fs.writeFile(path, '')
    await fs.expandTo(path)
  }

  const text = resolvePlaceholders(action.content).replace(/\r\n?/g, '\n')
  const ide = useIDEStore.getState()
  ide.openFileTab(path)
  useFileSystemStore.getState().select(path)

  const editor = await waitForEditor(path)
  if (editor && (action.config.typingAnimation || action.operation === 'CURSOR_POSITION')) {
    await animateInEditor(editor, action, text)
    useFileSystemStore.getState().setContent(path, editor.getModel()!.getValue())
  } else {
    const current = useFileSystemStore.getState().files[path]?.content ?? ''
    useFileSystemStore.getState().setContent(path, applyOperation(current, action, text))
  }

  await useFileSystemStore.getState().saveFile(path)
  return [{ path, before }]
}

async function waitForEditor(path: string): Promise<MonacoEditor.IStandaloneCodeEditor | null> {
  const target = modelPathFor(path)
  for (let elapsed = 0; elapsed < 3000; elapsed += 25) {
    const editor = getCodeEditor()
    if (editor?.getModel()?.uri.toString() === target) return editor
    await sleep(25)
  }
  return null
}

async function animateInEditor(
  editor: MonacoEditor.IStandaloneCodeEditor,
  action: FileAction,
  text: string
): Promise<void> {
  const model = editor.getModel()!
  const content = model.getValue().replace(/\r\n/g, '\n')
  let start: monaco.IPosition

  switch (action.operation) {
    case 'CREATE':
    case 'OVERWRITE':
      editor.executeEdits('ssc-step', [{ range: model.getFullModelRange(), text: '' }])
      start = { lineNumber: 1, column: 1 }
      break
    case 'PREPEND':
      start = { lineNumber: 1, column: 1 }
      if (content && !text.endsWith('\n')) text += '\n'
      break
    case 'REPLACE_TOKEN': {
      const token = action.replaceToken ?? ''
      const match = token ? model.findMatches(token, false, false, true, null, false)[0] : null
      if (!match) throw new StepError(`O texto "${token}" não foi encontrado no arquivo.`)
      editor.executeEdits('ssc-step', [{ range: match.range, text: '' }])
      start = match.range.getStartPosition()
      break
    }
    case 'CURSOR_POSITION': {
      const selection = editor.getSelection()
      if (selection && !selection.isEmpty()) {
        editor.executeEdits('ssc-step', [{ range: selection, text: '' }])
      }
      start = selection?.getStartPosition() ?? model.getFullModelRange().getEndPosition()
      break
    }
    case 'APPEND':
    default: {
      start = model.getFullModelRange().getEndPosition()
      if (content && !content.endsWith('\n')) text = '\n' + text
    }
  }

  editor.focus()
  if (!action.config.typingAnimation) {
    insertAt(editor, start, text)
  } else {
    await typeInto(editor, start, text, action.config.typingSpeedMs ?? DEFAULT_FILE_TYPING_MS)
  }
  editor.pushUndoStop()
}

function insertAt(
  editor: MonacoEditor.IStandaloneCodeEditor,
  position: monaco.IPosition,
  text: string
): monaco.IPosition {
  const range = new monaco.Range(
    position.lineNumber,
    position.column,
    position.lineNumber,
    position.column
  )
  editor.executeEdits('ssc-typing', [{ range, text, forceMoveMarkers: true }])
  const lines = text.split('\n')
  const end =
    lines.length === 1
      ? { lineNumber: position.lineNumber, column: position.column + text.length }
      : {
          lineNumber: position.lineNumber + lines.length - 1,
          column: lines[lines.length - 1].length + 1
        }
  editor.setPosition(end)
  editor.revealPositionInCenterIfOutsideViewport(end)
  return end
}

/** Splits text into typing chunks: a newline plus its indentation is typed at once. */
function typingChunks(text: string): string[] {
  return text.match(/\n[ \t]*|[\s\S]/gu) ?? []
}

async function typeInto(
  editor: MonacoEditor.IStandaloneCodeEditor,
  start: monaco.IPosition,
  text: string,
  speedMs: number
): Promise<void> {
  const chunks = typingChunks(text)
  let position = start
  for (let i = 0; i < chunks.length; i++) {
    if (skipRequested || editor.getModel() === null) {
      if (editor.getModel()) insertAt(editor, position, chunks.slice(i).join(''))
      return
    }
    position = insertAt(editor, position, chunks[i])
    if (speedMs > 0) await sleep(speedMs)
  }
}

// --- Terminal actions --------------------------------------------------------

async function runTerminalAction(action: TerminalAction): Promise<void> {
  const command = resolvePlaceholders(action.command).replace(/\r?\n/g, '\r')
  if (!command.trim()) throw new StepError('Este passo não tem nenhum comando.')

  useIDEStore.getState().setTerminalVisible(true)
  let id = getTerminalId()
  for (let elapsed = 0; id === null && elapsed < 3000; elapsed += 50) {
    await sleep(50)
    id = getTerminalId()
  }
  if (id === null) throw new StepError('O terminal não está disponível.')

  if (action.typingAnimation === false) {
    window.api.sendTerminalInput(id, command)
  } else {
    const speed = action.typingSpeedMs ?? DEFAULT_TERMINAL_TYPING_MS
    const chars = [...command]
    for (let i = 0; i < chars.length; i++) {
      if (skipRequested) {
        window.api.sendTerminalInput(id, chars.slice(i).join(''))
        break
      }
      window.api.sendTerminalInput(id, chars[i])
      await sleep(speed)
    }
  }
  if (action.executeImmediately) window.api.sendTerminalInput(id, '\r')
}

export function describeTarget(action: FileAction, root: string | null): string {
  if (action.operation !== 'CREATE' && action.targetMode === 'ACTIVE_FILE') return 'arquivo ativo'
  if (!action.targetPath) return 'sem caminho'
  const resolved = resolveInWorkspace(root, action.targetPath)
  return resolved ? relativeTo(root, resolved) : action.targetPath
}
