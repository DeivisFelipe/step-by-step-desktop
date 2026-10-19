import type { editor as MonacoEditor } from 'monaco-editor'
import {
  ChallengeAction,
  FileAction,
  FileTarget,
  HighlightAction,
  LessonNode,
  PreviewAction,
  SlideAction,
  StepAction,
  TerminalAction,
  WaitAction
} from '../types/schema'
import { useFileSystemStore } from '../store/useFileSystemStore'
import { useIDEStore } from '../store/useIDEStore'
import { useStageStore } from '../store/useStageStore'
import { useTerminalStore } from '../store/useTerminalStore'
import { workspaceFileUrl } from '../store/useSettingsStore'
import { resolvePlaceholders } from '../lib/tree'
import { isAbsolute, relativeTo, resolveInWorkspace, samePath } from '../lib/paths'
import {
  getCodeEditor,
  getTerminalId,
  markTerminalOutput,
  sleep,
  terminalOutputSinceMark
} from '../lib/registry'
import { modelPathFor, monaco } from '../lib/monaco'

/** What a step changed on disk, so it can be undone. `before === null` means the file was created. */
export interface FileChange {
  path: string
  before: string | null
}

export interface StepRun {
  changes: FileChange[]
  /** Set when an action failed; the changes made before it are still listed. */
  error: unknown | null
}

export interface RunOptions {
  /** No animations (used by "go to step"). */
  instant?: boolean
}

/** An error meant to be shown to the presenter as is. */
export class StepError extends Error {}

const DEFAULT_FILE_TYPING_MS = 30
const DEFAULT_TERMINAL_TYPING_MS = 35

let skipRequested = false

/** Finishes the running animation (or wait) immediately. */
export function skipAnimation(): void {
  skipRequested = true
}

interface Context {
  instant: boolean
  record: (change: FileChange) => void
}

export async function executeStep(step: LessonNode, options: RunOptions = {}): Promise<StepRun> {
  const changes: FileChange[] = []
  if (step.type !== 'STEP' || !step.data) return { changes, error: null }
  skipRequested = false
  useStageStore.getState().setHighlight(null)

  const ctx: Context = {
    instant: !!options.instant,
    // Keep only the first "before" of each file: that is what undo restores.
    record: (change) => {
      if (!changes.some((c) => samePath(c.path, change.path))) changes.push(change)
    }
  }
  try {
    for (const action of step.data.actions) await runAction(action, ctx)
    return { changes, error: null }
  } catch (error) {
    return { changes, error }
  }
}

async function runAction(action: StepAction, ctx: Context): Promise<void> {
  switch (action.kind) {
    case 'FILE':
      return runFileAction(action, ctx)
    case 'TERMINAL':
      return runTerminalAction(action, ctx)
    case 'WAIT':
      return runWaitAction(action)
    case 'SLIDE':
      return runSlideAction(action)
    case 'HIGHLIGHT':
      return runHighlightAction(action)
    case 'CHALLENGE':
      return runChallengeAction(action)
    case 'PREVIEW':
      return runPreviewAction(action)
    case 'OBS_SCENE':
      if (action.scene.trim()) window.api.obsSetScene(action.scene.trim())
      return
  }
}

/** Restores the files touched by a step. */
export async function revertChanges(changes: FileChange[]): Promise<void> {
  const fs = useFileSystemStore.getState()
  for (const change of [...changes].reverse()) {
    if (change.before === null) {
      if (await window.api.exists(change.path)) await fs.deleteNode(change.path)
    } else {
      await fs.writeFile(change.path, change.before)
    }
  }
  await useFileSystemStore.getState().refreshTree()
}

// --- File actions ------------------------------------------------------------

export function resolveTarget(target: FileTarget, operation?: FileAction['operation']): string {
  const { rootPath } = useFileSystemStore.getState()
  const usesPath = operation === 'CREATE' || target.targetMode === 'SPECIFIC_PATH'
  if (!usesPath) {
    const active = useIDEStore.getState().activeFilePath()
    if (!active) {
      throw new StepError(
        'Este passo usa o arquivo ativo, mas nenhum arquivo está aberto no editor.'
      )
    }
    return active
  }
  if (!target.targetPath?.trim()) throw new StepError('Informe o caminho do arquivo deste passo.')
  const path = resolveInWorkspace(rootPath, target.targetPath)
  if (!path) throw new StepError('Abra uma pasta para usar caminhos relativos.')
  return path
}

/** Plain string version of each operation (used when there is no typing animation). */
export function applyOperation(current: string, action: FileAction, text: string): string {
  switch (action.operation) {
    case 'CREATE':
    case 'OVERWRITE':
      return text
    case 'DELETE':
      return ''
    case 'PREPEND':
      return text + (current && !text.endsWith('\n') ? '\n' : '') + current
    case 'REPLACE_TOKEN': {
      const token = action.replaceToken ?? ''
      if (!token || !current.includes(token)) {
        throw new StepError(`O texto "${token}" não foi encontrado no arquivo.`)
      }
      return current.replace(token, () => text)
    }
    case 'INSERT_AFTER': {
      const anchor = action.replaceToken ?? ''
      if (!anchor || !current.includes(anchor)) {
        throw new StepError(`O texto "${anchor}" não foi encontrado no arquivo.`)
      }
      return current.replace(anchor, () => anchor + text)
    }
    case 'APPEND':
    case 'CURSOR_POSITION':
    default:
      return current + (current && !current.endsWith('\n') ? '\n' : '') + text
  }
}

/** 1-based lines of `after` that differ from `before` (common prefix/suffix trimmed). */
function changedLines(before: string, after: string): number[] {
  const a = before.split('\n')
  const b = after.split('\n')
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start++
  let endA = a.length - 1
  let endB = b.length - 1
  while (endA >= start && endB >= start && a[endA] === b[endB]) {
    endA--
    endB--
  }
  const lines: number[] = []
  for (let i = start; i <= endB; i++) lines.push(i + 1)
  return lines
}

async function runFileAction(action: FileAction, ctx: Context): Promise<void> {
  const path = resolveTarget(action, action.operation)
  const fs = useFileSystemStore.getState()
  const stage = useStageStore.getState()

  const existed = await window.api.exists(path)
  let before: string | null = null
  if (existed) {
    const cached = useFileSystemStore.getState().files[path]
    // Re-read from disk unless the presenter has unsaved edits in the editor.
    if (!cached || cached.content === cached.savedContent) {
      if (!(await fs.loadFile(path, true))) throw new StepError(`Não foi possível ler ${path}.`)
    }
    before = useFileSystemStore.getState().files[path].content
  }

  if (action.operation === 'DELETE') {
    if (!existed) throw new StepError(`O arquivo ${relativeTo(fs.rootPath, path)} não existe.`)
    ctx.record({ path, before })
    await fs.deleteNode(path)
    return
  }

  if (!existed) {
    if (action.operation !== 'CREATE' && action.targetMode === 'ACTIVE_FILE') {
      throw new StepError('O arquivo ativo não existe mais no disco.')
    }
    await fs.writeFile(path, '')
    await fs.expandTo(path)
  }
  ctx.record({ path, before })

  const text = resolvePlaceholders(action.content).replace(/\r\n?/g, '\n')
  useIDEStore.getState().openFileTab(path)
  useFileSystemStore.getState().select(path)
  stage.setView('code', true)

  const animation = ctx.instant ? 'NONE' : (action.config.animation ?? 'TYPING')
  const editor = await waitForEditor(path)

  if (editor && animation === 'TYPING') {
    stage.setCodeTransition('typing')
    await animateInEditor(editor, action, text, true)
    useFileSystemStore.getState().setContent(path, editor.getModel()!.getValue())
  } else if (editor && action.operation === 'CURSOR_POSITION') {
    stage.setCodeTransition(animation === 'MORPH' ? 'morph' : 'none')
    const previous = editor.getModel()!.getValue()
    await animateInEditor(editor, action, text, false)
    const value = editor.getModel()!.getValue()
    useFileSystemStore.getState().setContent(path, value)
    if (animation === 'MORPH') stage.flashLines(path, changedLines(previous, value))
  } else {
    const current = useFileSystemStore.getState().files[path]?.content ?? ''
    const next = applyOperation(current, action, text)
    stage.setCodeTransition(animation === 'MORPH' ? 'morph' : 'none')
    useFileSystemStore.getState().setContent(path, next)
    if (animation !== 'TYPING') stage.flashLines(path, changedLines(current, next))
  }

  await useFileSystemStore.getState().saveFile(path)
  // Let the presentation pages pick up the transition before typing resumes.
  setTimeout(() => useStageStore.getState().setCodeTransition('typing'), 100)
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
  text: string,
  typing: boolean
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
    case 'INSERT_AFTER': {
      const anchor = action.replaceToken ?? ''
      const match = anchor ? model.findMatches(anchor, false, false, true, null, false)[0] : null
      if (!match) throw new StepError(`O texto "${anchor}" não foi encontrado no arquivo.`)
      start = match.range.getEndPosition()
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
  if (!typing) insertAt(editor, start, text)
  else await typeInto(editor, start, text, action.config.typingSpeedMs ?? DEFAULT_FILE_TYPING_MS)
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

/** Small natural pauses after punctuation make the typing feel less mechanical. */
function delayAfter(chunk: string, speedMs: number): number {
  if (chunk.startsWith('\n')) return speedMs * 4
  if (/[;{}),.]/.test(chunk)) return speedMs * 2.5
  return speedMs * (0.7 + Math.random() * 0.6)
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
    if (speedMs > 0) await sleep(delayAfter(chunks[i], speedMs))
  }
}

// --- Terminal ----------------------------------------------------------------

async function terminalFor(name: string | undefined): Promise<{ key: string; id: number }> {
  const terminals = useTerminalStore.getState()
  const key = terminals.ensure(name)
  terminals.setActive(key)
  useIDEStore.getState().setTerminalVisible(true)
  for (let elapsed = 0; elapsed < 5000; elapsed += 50) {
    const id = getTerminalId(key)
    if (id !== null) return { key, id }
    await sleep(50)
  }
  throw new StepError('O terminal não está disponível.')
}

async function runTerminalAction(action: TerminalAction, ctx: Context): Promise<void> {
  const command = resolvePlaceholders(action.command).replace(/\r?\n/g, '\r')
  if (!command.trim()) throw new StepError('Este passo não tem nenhum comando.')

  const { key, id } = await terminalFor(action.terminal)
  const stage = useStageStore.getState()
  stage.setTerminal(key)
  stage.setView('terminal', true)
  markTerminalOutput(id)

  if (ctx.instant || action.typingAnimation === false) {
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

function matchesOutput(output: string, pattern: string): boolean {
  const regex = /^\/(.+)\/([a-z]*)$/.exec(pattern)
  if (regex) {
    try {
      return new RegExp(regex[1], regex[2]).test(output)
    } catch {
      // invalid regex: fall back to plain text
    }
  }
  return output.toLowerCase().includes(pattern.toLowerCase())
}

async function runWaitAction(action: WaitAction): Promise<void> {
  const pattern = action.pattern.trim()
  if (!pattern) throw new StepError('Informe o texto que deve aparecer no terminal.')
  const { id } = await terminalFor(action.terminal)
  const timeout = Math.max(1, action.timeoutSec || 60) * 1000
  for (let elapsed = 0; elapsed < timeout; elapsed += 100) {
    if (skipRequested) return
    if (matchesOutput(terminalOutputSinceMark(id), pattern)) return
    await sleep(100)
  }
  throw new StepError(`"${pattern}" não apareceu no terminal em ${Math.round(timeout / 1000)} s.`)
}

// --- Stage actions -----------------------------------------------------------

/** Turns a workspace-relative path into a URL the IDE and the presentation pages can load. */
export function resolveAssetUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed) return undefined
  if (/^(https?|data):/i.test(trimmed)) return trimmed
  const root = useFileSystemStore.getState().rootPath
  const relative = isAbsolute(trimmed) && root ? relativeTo(root, trimmed) : trimmed
  return workspaceFileUrl(relative) ?? undefined
}

async function runSlideAction(action: SlideAction): Promise<void> {
  useStageStore.getState().showSlide({
    markdown: resolvePlaceholders(action.markdown),
    image: resolveAssetUrl(action.image)
  })
  useIDEStore.getState().openSpecialTab('SLIDE')
}

async function runChallengeAction(action: ChallengeAction): Promise<void> {
  const durationSec = Math.max(0, action.durationSec || 0)
  useStageStore.getState().showChallenge({
    markdown: resolvePlaceholders(action.markdown),
    durationSec,
    endsAt: Date.now() + durationSec * 1000
  })
  useIDEStore.getState().openSpecialTab('CHALLENGE')
}

async function runPreviewAction(action: PreviewAction): Promise<void> {
  const url = resolveAssetUrl(action.url)
  if (!url) throw new StepError('Informe o endereço ou arquivo do preview.')
  useStageStore.getState().showPreview(url)
  useIDEStore.getState().openSpecialTab('PREVIEW')
}

async function runHighlightAction(action: HighlightAction): Promise<void> {
  const path = resolveTarget(action)
  const fs = useFileSystemStore.getState()
  if (!(await fs.loadFile(path))) {
    throw new StepError(`O arquivo ${relativeTo(fs.rootPath, path)} não existe.`)
  }
  const lineCount = useFileSystemStore.getState().files[path].content.split('\n').length
  const startLine = Math.max(1, Math.min(action.startLine, action.endLine))
  const endLine = Math.min(lineCount, Math.max(action.startLine, action.endLine))
  if (startLine > lineCount) {
    throw new StepError(
      `O arquivo tem só ${lineCount} linhas; não dá para destacar a ${startLine}.`
    )
  }
  useIDEStore.getState().openFileTab(path)
  const stage = useStageStore.getState()
  stage.setHighlight({ path, startLine, endLine, note: action.note?.trim() || undefined })
  stage.setView('code', true)
}

/** Short description of a file action's target, for summaries. */
export function describeTarget(
  target: FileTarget & { operation?: FileAction['operation'] },
  root: string | null
): string {
  if (target.operation !== 'CREATE' && target.targetMode === 'ACTIVE_FILE') return 'arquivo ativo'
  if (!target.targetPath) return 'sem caminho'
  const resolved = resolveInWorkspace(root, target.targetPath)
  return resolved ? relativeTo(root, resolved) : target.targetPath
}

/** One line summary of an action (outline, diagram, presenter view). */
export function describeAction(action: StepAction, root: string | null): string {
  switch (action.kind) {
    case 'FILE':
      return describeTarget(action, root)
    case 'TERMINAL':
      return `$ ${action.command.split('\n')[0]}`
    case 'WAIT':
      return `esperar "${action.pattern}"`
    case 'SLIDE':
      return (
        action.markdown
          .split('\n')
          .find((l) => l.trim())
          ?.replace(/^#+\s*/, '') ?? 'slide'
      )
    case 'HIGHLIGHT':
      return `${describeTarget(action, root)}:${action.startLine}-${action.endLine}`
    case 'CHALLENGE':
      return `desafio ${Math.round(action.durationSec / 60)} min`
    case 'PREVIEW':
      return action.url
    case 'OBS_SCENE':
      return `cena "${action.scene}"`
  }
}
