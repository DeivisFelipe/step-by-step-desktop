import { create } from 'zustand'
import { FileAction, LessonNode, StepAction } from '../types/schema'
import { flattenSteps, resolvePlaceholders } from '../lib/tree'
import { isAbsolute, joinPath, relativeTo, resolveInWorkspace } from '../lib/paths'
import { useFileSystemStore } from '../store/useFileSystemStore'
import { useIDEStore } from '../store/useIDEStore'
import { useLessonStore } from '../store/useLessonStore'
import { useSettingsStore } from '../store/useSettingsStore'
import { applyOperation, StepError } from './ExecutionEngine'

export interface RehearsalIssue {
  stepId: string
  stepTitle: string
  stepNumber: number
  actionIndex: number | null
  level: 'error' | 'warning' | 'info'
  message: string
}

export interface RehearsalReport {
  issues: RehearsalIssue[]
  steps: number
  commandsRun: number
  durationMs: number
  usedSnapshot: boolean
}

interface RehearsalStore {
  running: boolean
  progress: string
  runCommands: boolean
  report: RehearsalReport | null
  setRunCommands: (value: boolean) => void
  run: () => Promise<void>
}

const COMMAND_TIMEOUT_MS = 120_000

/**
 * Runs the whole lesson against an in-memory copy of the project, without
 * animations, and reports what would fail in class. Optionally runs the
 * terminal commands in a temporary copy of the project.
 */
async function rehearse(
  runCommands: boolean,
  onProgress: (text: string) => void
): Promise<RehearsalReport> {
  const started = Date.now()
  const root = useFileSystemStore.getState().rootPath
  const tree = useLessonStore.getState().tree
  const steps = flattenSteps(tree)
  const issues: RehearsalIssue[] = []
  if (!root) throw new Error('Abra a pasta do projeto para ensaiar a aula.')

  // Simulate from the start of the lesson when a session is in progress.
  const usedSnapshot = await window.api.snapshotExists(root)
  const base = usedSnapshot ? joinPath(root, '.stepbystep', 'inicio') : root
  const toBase = (path: string): string => joinPath(base, relativeTo(root, path))

  const files = new Map<string, string | null>()
  const pending: Record<string, string | null> = {}
  const read = async (path: string): Promise<string | null> => {
    if (!files.has(path)) files.set(path, await window.api.readFile(toBase(path)))
    return files.get(path)!
  }
  const write = (path: string, content: string | null): void => {
    files.set(path, content)
    pending[relativeTo(root, path)] = content
  }

  let activeFile = useIDEStore.getState().activeFilePath()
  let tempDir: string | null = null
  let shell = ''
  let commandsRun = 0
  /** Result of the last command, for a following "wait" action. */
  let lastExec: { matched: boolean; waitFor?: string } | null = null

  if (runCommands) {
    onProgress('Copiando o projeto para uma pasta temporária…')
    tempDir = await window.api.rehearsalPrepare(base)
    shell = (await window.api.getAvailableShells())[0] ?? ''
  }

  try {
    for (let s = 0; s < steps.length; s++) {
      const step = steps[s]
      const actions = step.data?.actions ?? []
      const issue = (
        level: RehearsalIssue['level'],
        message: string,
        actionIndex: number | null
      ): void => {
        issues.push({
          stepId: step.id,
          stepTitle: step.title,
          stepNumber: s + 1,
          actionIndex,
          level,
          message
        })
      }
      onProgress(`Passo ${s + 1} de ${steps.length}: ${step.title}`)
      if (actions.length === 0) issue('warning', 'O passo não tem nenhuma ação.', null)

      for (let a = 0; a < actions.length; a++) {
        const action = actions[a]
        const report = (level: RehearsalIssue['level'], message: string): void =>
          issue(level, message, a)

        const target = (
          t: { targetMode: string; targetPath?: string },
          create = false
        ): string | null => {
          if (create || t.targetMode === 'SPECIFIC_PATH') {
            if (!t.targetPath?.trim()) {
              report('error', 'Falta o caminho do arquivo.')
              return null
            }
            return resolveInWorkspace(root, t.targetPath)
          }
          if (!activeFile) {
            report(
              'warning',
              'Usa o "arquivo ativo", mas nenhum passo anterior abriu um arquivo: depende do que estiver aberto no editor.'
            )
            return null
          }
          return activeFile
        }

        switch (action.kind) {
          case 'FILE': {
            const path = target(action, action.operation === 'CREATE')
            if (!path) break
            const rel = relativeTo(root, path)
            const current = await read(path)
            if (action.operation === 'DELETE') {
              if (current === null) report('error', `${rel} não existe para ser excluído.`)
              else write(path, null)
              break
            }
            if (action.operation === 'CREATE' && current !== null) {
              report('warning', `${rel} já existe e será sobrescrito.`)
            }
            if (action.operation !== 'CREATE' && current === null) {
              report('info', `${rel} ainda não existe; será criado vazio antes da edição.`)
            }
            if (action.operation === 'CURSOR_POSITION') {
              report(
                'info',
                'Depende da posição do cursor; no ensaio foi tratado como "acrescentar ao final".'
              )
            }
            if (!action.content.trim()) report('warning', 'O conteúdo está vazio.')
            try {
              write(
                path,
                applyOperation(
                  current ?? '',
                  action as FileAction,
                  resolvePlaceholders(action.content)
                )
              )
            } catch (e) {
              report('error', e instanceof StepError ? e.message : String(e))
            }
            activeFile = path
            break
          }
          case 'HIGHLIGHT': {
            const path = target(action)
            if (!path) break
            const content = await read(path)
            if (content === null) {
              report('error', `${relativeTo(root, path)} não existe.`)
              break
            }
            const lines = content.split('\n').length
            if (action.startLine > lines) {
              report(
                'error',
                `O arquivo tem ${lines} linhas; o destaque começa na linha ${action.startLine}.`
              )
            } else if (action.endLine > lines) {
              report(
                'warning',
                `O destaque vai até a linha ${action.endLine}, mas o arquivo tem ${lines}.`
              )
            }
            activeFile = path
            break
          }
          case 'TERMINAL': {
            if (!action.command.trim()) {
              report('error', 'O comando está vazio.')
              break
            }
            if (!tempDir) {
              report('info', 'Comando não executado no ensaio.')
              break
            }
            if (!action.executeImmediately) {
              report('info', 'O comando só é digitado (sem Enter); não foi executado.')
              break
            }
            const next = actions[a + 1] as StepAction | undefined
            const waitFor = next?.kind === 'WAIT' ? next.pattern.trim() : undefined
            await window.api.rehearsalWrite(tempDir, { ...pending })
            for (const key of Object.keys(pending)) delete pending[key]
            onProgress(`Passo ${s + 1}: executando ${action.command.split('\n')[0]}`)
            for (const line of resolvePlaceholders(action.command)
              .split('\n')
              .filter((l) => l.trim())) {
              const result = await window.api.rehearsalExec({
                cwd: tempDir,
                command: line,
                shell,
                waitFor: waitFor || undefined,
                timeoutMs:
                  next?.kind === 'WAIT' ? Math.max(1, next.timeoutSec) * 1000 : COMMAND_TIMEOUT_MS
              })
              commandsRun++
              lastExec = { matched: result.matched, waitFor }
              if (result.matched) continue
              if (result.timedOut) {
                report(
                  waitFor ? 'error' : 'warning',
                  waitFor
                    ? `"${waitFor}" não apareceu na saída de "${line}" a tempo.`
                    : `"${line}" não terminou em ${COMMAND_TIMEOUT_MS / 1000} s (é um servidor? Use uma ação "Esperar o terminal").`
                )
              } else if (!result.ok) {
                const tail = result.output.trim().split('\n').slice(-4).join('\n')
                report(
                  'error',
                  `"${line}" falhou (código ${result.code ?? '?'}).${tail ? `\n${tail}` : ''}`
                )
              }
            }
            break
          }
          case 'WAIT':
            if (!action.pattern.trim()) report('error', 'Falta o texto a esperar.')
            else if (!tempDir) report('info', 'Espera não verificada (comandos não executados).')
            else if (!lastExec?.waitFor) {
              report('warning', 'A espera não vem logo depois de um comando; não foi verificada.')
            }
            lastExec = null
            break
          case 'SLIDE':
            if (!action.markdown.trim() && !action.image?.trim()) {
              report('warning', 'O slide está vazio.')
            }
            if (action.image?.trim() && !/^(https?|data):/i.test(action.image.trim())) {
              const image = isAbsolute(action.image) ? action.image : joinPath(root, action.image)
              if (!(await window.api.exists(toBase(image)))) {
                report('error', `A imagem ${action.image} não existe.`)
              }
            }
            break
          case 'CHALLENGE':
            if (!action.markdown.trim()) report('warning', 'O desafio não tem enunciado.')
            break
          case 'PREVIEW': {
            const url = action.url.trim()
            if (!url) report('error', 'Falta o endereço do preview.')
            else if (/^https?:/i.test(url)) report('info', 'Endereço externo não verificado.')
            else {
              const path = isAbsolute(url) ? url : joinPath(root, url.split(/[?#]/)[0])
              if ((await read(path)) === null && !(await window.api.exists(toBase(path)))) {
                report('error', `${url} não existe na pasta.`)
              }
            }
            break
          }
          case 'OBS_SCENE': {
            const scene = action.scene.trim()
            const obs = useSettingsStore.getState().obs
            if (!scene) report('error', 'Falta o nome da cena.')
            else if (obs?.connected && !obs.scenes.includes(scene)) {
              report('error', `A cena "${scene}" não existe no OBS.`)
            } else if (!obs?.connected) report('info', 'OBS não conectado; cena não verificada.')
            break
          }
        }
      }
    }
  } finally {
    if (tempDir) await window.api.rehearsalCleanup(tempDir)
  }

  return {
    issues,
    steps: steps.length,
    commandsRun,
    durationMs: Date.now() - started,
    usedSnapshot
  }
}

export const useRehearsalStore = create<RehearsalStore>((set, get) => ({
  running: false,
  progress: '',
  runCommands: false,
  report: null,
  setRunCommands: (runCommands) => set({ runCommands }),
  run: async () => {
    if (get().running) return
    set({ running: true, progress: 'Preparando…' })
    try {
      const report = await rehearse(get().runCommands, (progress) => set({ progress }))
      set({ report })
    } catch (e) {
      useIDEStore.getState().notify(e instanceof Error ? e.message : String(e), 'error')
    } finally {
      set({ running: false, progress: '' })
    }
  }
}))

export function stepOf(tree: LessonNode[], id: string): LessonNode | undefined {
  return flattenSteps(tree).find((s) => s.id === id)
}
