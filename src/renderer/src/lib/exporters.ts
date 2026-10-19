import { FileAction, LessonNode } from '../types/schema'
import { GitExportStep, GitFileChange } from '../../../shared/ipc'
import { useFileSystemStore } from '../store/useFileSystemStore'
import { reportError, useIDEStore } from '../store/useIDEStore'
import { useLessonStore } from '../store/useLessonStore'
import { applyOperation } from '../engine/ExecutionEngine'
import { defaultAction, flattenSteps, newId, resolvePlaceholders } from './tree'
import { basename, joinPath, relativeTo, resolveInWorkspace } from './paths'
import { lessonToHandout, lessonToMarkdown, parseLessonMarkdown } from './lessonMarkdown'
import { renderMarkdown } from '../../common/markdown'

function lessonName(): string {
  const { title } = useLessonStore.getState()
  const root = useFileSystemStore.getState().rootPath
  return title || (root ? basename(root) : 'aula')
}

function safeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*]+/g, '-').trim() || 'aula'
}

export async function exportLessonMarkdown(): Promise<void> {
  const path = await window.api.showSaveDialog({
    title: 'Exportar aula como Markdown',
    defaultPath: `${safeFileName(lessonName())}.aula.md`,
    filters: [{ name: 'Markdown', extensions: ['md'] }]
  })
  if (!path) return
  const { tree, title } = useLessonStore.getState()
  try {
    await window.api.writeFile(path, lessonToMarkdown(tree, title))
    useIDEStore.getState().notify('Aula exportada.', 'success')
  } catch (e) {
    reportError(e, 'Não foi possível exportar')
  }
}

export async function importLessonMarkdown(): Promise<void> {
  const path = await window.api.showOpenFileDialog({
    title: 'Importar aula em Markdown',
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }]
  })
  if (!path) return
  const text = await window.api.readFile(path)
  if (text === null) return reportError(new Error('Não foi possível ler o arquivo.'))
  const { title, tree } = parseLessonMarkdown(text)
  const steps = flattenSteps(tree).length
  if (steps === 0) {
    useIDEStore.getState().notify('Nenhum passo encontrado no arquivo.', 'warning')
    return
  }
  const lesson = useLessonStore.getState()
  const choice = await window.api.showMessage({
    type: 'question',
    message: `Importar ${steps} passo(s) de ${basename(path)}?`,
    buttons: ['Adicionar ao final', 'Substituir a aula atual', 'Cancelar'],
    defaultId: 0,
    cancelId: 2
  })
  if (choice === 2) return
  if (choice === 1) lesson.replaceTree(tree, title || lesson.title)
  else lesson.appendNodes(tree)
  useIDEStore.getState().setActiveActivity('STEPS')
  useIDEStore.getState().notify(`${steps} passo(s) importado(s).`, 'success')
}

const HANDOUT_CSS = `
body { font-family: 'Segoe UI', system-ui, sans-serif; color: #1f2937; line-height: 1.55; max-width: 780px; margin: 0 auto; padding: 24px; }
h1 { font-size: 28px; border-bottom: 3px solid #4f46e5; padding-bottom: 8px; }
h2 { font-size: 22px; color: #4338ca; margin-top: 32px; }
h3 { font-size: 17px; margin-top: 24px; page-break-after: avoid; }
pre { background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 14px; font-size: 12.5px; white-space: pre-wrap; page-break-inside: avoid; }
code { font-family: 'Cascadia Code', Consolas, monospace; }
:not(pre) > code { background: #eef2ff; padding: 1px 5px; border-radius: 4px; font-size: 0.9em; }
blockquote { border-left: 4px solid #a5b4fc; margin: 12px 0; padding: 4px 12px; color: #4b5563; background: #f8fafc; }
img { max-width: 100%; }
`

export async function exportHandout(format: 'md' | 'pdf'): Promise<void> {
  const name = lessonName()
  const path = await window.api.showSaveDialog({
    title: 'Exportar apostila',
    defaultPath: `${safeFileName(name)} - apostila.${format}`,
    filters: [
      format === 'pdf'
        ? { name: 'PDF', extensions: ['pdf'] }
        : { name: 'Markdown', extensions: ['md'] }
    ]
  })
  if (!path) return
  const { tree, title } = useLessonStore.getState()
  const root = useFileSystemStore.getState().rootPath
  const markdown = lessonToHandout(tree, title, root ? basename(root) : 'Aula')
  try {
    if (format === 'md') await window.api.writeFile(path, markdown)
    else {
      const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${name}</title><style>${HANDOUT_CSS}</style></head><body>${renderMarkdown(markdown)}</body></html>`
      await window.api.exportPdf(html, path)
    }
    useIDEStore.getState().notify('Apostila exportada.', 'success')
  } catch (e) {
    reportError(e, 'Não foi possível exportar a apostila')
  }
}

/**
 * Replays the file actions of every step in memory (from the start of the lesson)
 * and returns what each step changes, relative to the workspace.
 */
async function simulateSteps(root: string): Promise<GitExportStep[]> {
  const hasSnapshot = await window.api.snapshotExists(root)
  const base = hasSnapshot ? joinPath(root, '.stepbystep', 'inicio') : root
  const files = new Map<string, string | null>()
  const read = async (path: string): Promise<string | null> => {
    if (!files.has(path))
      files.set(path, await window.api.readFile(joinPath(base, relativeTo(root, path))))
    return files.get(path)!
  }
  let lastFile: string | null = null
  const result: GitExportStep[] = []
  for (const [index, step] of flattenSteps(useLessonStore.getState().tree).entries()) {
    const changed: Record<string, string | null> = {}
    for (const action of step.data?.actions ?? []) {
      if (action.kind !== 'FILE' && action.kind !== 'HIGHLIGHT') continue
      const usesPath =
        action.targetMode === 'SPECIFIC_PATH' ||
        (action.kind === 'FILE' && action.operation === 'CREATE')
      const path =
        usesPath && action.targetPath ? resolveInWorkspace(root, action.targetPath) : lastFile
      if (!path) continue
      lastFile = path
      if (action.kind !== 'FILE') continue
      const current = (await read(path)) ?? ''
      let next: string | null
      try {
        next =
          action.operation === 'DELETE'
            ? null
            : applyOperation(current, action, resolvePlaceholders(action.content))
      } catch {
        continue
      }
      files.set(path, next)
      changed[relativeTo(root, path)] = next
    }
    const caption = step.data?.caption?.trim()
    result.push({
      message: `Passo ${index + 1}: ${step.title}${caption ? `\n\n${caption}` : ''}`,
      files: changed
    })
  }
  return result
}

export async function exportGitRepository(): Promise<void> {
  const root = useFileSystemStore.getState().rootPath
  if (!root) return
  const target = await window.api.openFolder()
  if (!target) return
  try {
    const steps = await simulateSteps(root)
    await window.api.gitExport(root, target, steps)
    useIDEStore
      .getState()
      .notify(`Repositório criado com ${steps.length + 1} commits em ${target}.`, 'success', 8000)
  } catch (e) {
    reportError(e, 'Não foi possível criar o repositório')
  }
}

// --- Import from git history ---------------------------------------------------

function commonPrefix(a: string, b: string): number {
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  return i
}

function commonSuffix(a: string, b: string, max: number): number {
  let i = 0
  while (i < max && a[a.length - 1 - i] === b[b.length - 1 - i]) i++
  return i
}

function occurrences(text: string, part: string): number {
  if (!part) return 0
  let count = 0
  for (let i = text.indexOf(part); i !== -1; i = text.indexOf(part, i + 1)) count++
  return count
}

/** Picks the action that best "replays" a file change as typing. */
export function actionForChange(change: GitFileChange, morph: boolean): FileAction | null {
  const base = defaultAction('FILE') as FileAction
  const action = (patch: Partial<FileAction>): FileAction => ({
    ...base,
    targetMode: 'SPECIFIC_PATH',
    targetPath: change.path,
    ...patch,
    config: { animation: morph ? 'MORPH' : 'TYPING', typingSpeedMs: 25 }
  })

  if (change.status === 'D') return action({ operation: 'DELETE', content: '' })
  if (change.after === null) return null
  if (change.status === 'A' || change.before === null) {
    return action({ operation: 'CREATE', content: change.after })
  }
  const before = change.before.replace(/\r\n/g, '\n')
  const after = change.after.replace(/\r\n/g, '\n')
  if (before === after) return null
  if (morph) return action({ operation: 'OVERWRITE', content: after })

  if (after.startsWith(before) && (before === '' || before.endsWith('\n'))) {
    return action({ operation: 'APPEND', content: after.slice(before.length) })
  }

  let start = commonPrefix(before, after)
  const end = commonSuffix(before, after, Math.min(before.length, after.length) - start)
  const removed = before.slice(start, before.length - end)
  const added = after.slice(start, after.length - end)

  if (!removed) {
    // Pure insertion: anchor on the text right before it, growing until unique.
    let anchorStart = before.lastIndexOf('\n', start - 2) + 1
    while (anchorStart > 0 && occurrences(before, before.slice(anchorStart, start)) !== 1) {
      anchorStart = before.lastIndexOf('\n', anchorStart - 2) + 1
    }
    const anchor = before.slice(anchorStart, start)
    if (anchor && occurrences(before, anchor) === 1) {
      return action({ operation: 'INSERT_AFTER', replaceToken: anchor, content: added })
    }
    if (start === 0) return action({ operation: 'PREPEND', content: added })
  } else {
    // Replacement: widen the removed text with context until it is unique.
    while (start > 0 && occurrences(before, before.slice(start, before.length - end)) !== 1) {
      start = before.lastIndexOf('\n', start - 2) + 1
    }
    const token = before.slice(start, before.length - end)
    if (occurrences(before, token) === 1) {
      return action({
        operation: 'REPLACE_TOKEN',
        replaceToken: token,
        content: after.slice(start, after.length - end)
      })
    }
  }
  return { ...action({ operation: 'OVERWRITE', content: after }), config: { animation: 'MORPH' } }
}

export function stepFromCommit(
  subject: string,
  body: string,
  changes: GitFileChange[],
  morph: boolean,
  parentId: string
): LessonNode {
  const actions = changes
    .map((change) => actionForChange(change, morph))
    .filter((a): a is FileAction => a !== null)
  return {
    id: newId(),
    parentId,
    type: 'STEP',
    title: subject,
    data: { actions, caption: body || undefined }
  }
}
