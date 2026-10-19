import { FileAction, FileAnimation, FileOperation, LessonNode, StepAction } from '../types/schema'
import { defaultAction, flattenSteps, newId, resolvePlaceholders } from './tree'
import { languageFromPath } from './paths'

// Lessons as Markdown: easy to write in any editor, review and share.
//
//   # Fluxo                      → flow
//   ## Passo                     → step
//   Paragraphs                   → public caption
//   > Nota: …                    → private presenter notes
//   ```js arquivo="src/a.js" operacao="criar"   → file action
//   ```terminal nome="Servidor"  → terminal command (one per line)
//   ```esperar tempo="60"        → wait for text in the terminal
//   ```slide imagem="a.png"      → slide (Markdown)
//   ```destacar arquivo="a.js" linhas="3-5"  → highlight (body = note)
//   ```desafio tempo="5"         → challenge (minutes; body = statement)
//   ```preview                   → preview (body = URL or file)
//   ```obs                       → OBS scene (body = scene name)

const OPERATIONS: Record<FileOperation, string> = {
  CREATE: 'criar',
  APPEND: 'acrescentar',
  PREPEND: 'inicio',
  REPLACE_TOKEN: 'substituir',
  INSERT_AFTER: 'inserir-depois',
  CURSOR_POSITION: 'cursor',
  OVERWRITE: 'sobrescrever',
  DELETE: 'excluir'
}
const ANIMATIONS: Record<FileAnimation, string> = {
  TYPING: 'digitar',
  MORPH: 'transformar',
  NONE: 'nenhuma'
}
const KINDS = new Set(['terminal', 'esperar', 'slide', 'destacar', 'desafio', 'preview', 'obs'])

function invert<K extends string>(record: Record<K, string>): Record<string, K> {
  return Object.fromEntries(Object.entries(record).map(([k, v]) => [v, k])) as Record<string, K>
}
const OPERATION_BY_NAME = invert(OPERATIONS)
const ANIMATION_BY_NAME = invert(ANIMATIONS)

function attr(name: string, value: string | number | undefined | null): string {
  if (value === undefined || value === null || value === '') return ''
  return ` ${name}=${JSON.stringify(String(value))}`
}

/** Fence long enough not to clash with backticks inside the content. */
function fence(info: string, body: string): string {
  const longest = Math.max(2, ...(body.match(/`+/g) ?? []).map((m) => m.length))
  const ticks = '`'.repeat(longest + 1)
  return `${ticks}${info}\n${body.replace(/\n$/, '')}\n${ticks}`
}

function serializeAction(action: StepAction): string {
  switch (action.kind) {
    case 'FILE': {
      const lang = action.config.language ?? (languageFromPath(action.targetPath) || 'text')
      const info =
        (lang === 'plaintext' ? 'text' : lang) +
        attr(
          'arquivo',
          action.targetMode === 'SPECIFIC_PATH' || action.operation === 'CREATE'
            ? action.targetPath
            : ''
        ) +
        attr('operacao', OPERATIONS[action.operation]) +
        attr('texto', action.replaceToken) +
        attr(
          'animacao',
          action.config.animation === 'TYPING' ? '' : ANIMATIONS[action.config.animation]
        ) +
        attr(
          'velocidade',
          action.config.animation === 'TYPING' ? action.config.typingSpeedMs : ''
        ) +
        // Code blocks end with a line break; mark content that does not.
        attr('quebra-final', action.content.endsWith('\n') ? '' : 'nao')
      return fence(info, action.operation === 'DELETE' ? '' : action.content)
    }
    case 'TERMINAL':
      return fence(
        'terminal' +
          attr('nome', action.terminal) +
          attr('enter', action.executeImmediately ? '' : 'nao') +
          attr('digitar', action.typingAnimation === false ? 'nao' : ''),
        action.command
      )
    case 'WAIT':
      return fence(
        'esperar' + attr('nome', action.terminal) + attr('tempo', action.timeoutSec),
        action.pattern
      )
    case 'SLIDE':
      return fence('slide' + attr('imagem', action.image), action.markdown)
    case 'HIGHLIGHT':
      return fence(
        'destacar' +
          attr('arquivo', action.targetMode === 'SPECIFIC_PATH' ? action.targetPath : '') +
          attr('linhas', `${action.startLine}-${action.endLine}`),
        action.note ?? ''
      )
    case 'CHALLENGE':
      return fence('desafio' + attr('tempo', action.durationSec / 60), action.markdown)
    case 'PREVIEW':
      return fence('preview', action.url)
    case 'OBS_SCENE':
      return fence('obs', action.scene)
  }
}

/** The whole lesson as editable Markdown (round-trips through `parseLessonMarkdown`). */
export function lessonToMarkdown(tree: LessonNode[], title: string): string {
  const out: string[] = []
  if (title) out.push(`---\ntitulo: ${title}\n---\n`)
  const writeStep = (step: LessonNode): void => {
    out.push(`## ${step.title}\n`)
    if (step.data?.caption?.trim()) out.push(`${step.data.caption.trim()}\n`)
    if (step.data?.presenterNotes?.trim()) {
      out.push(
        step.data.presenterNotes
          .trim()
          .split('\n')
          .map((line, i) => `> ${i === 0 ? 'Nota: ' : ''}${line}`)
          .join('\n') + '\n'
      )
    }
    for (const action of step.data?.actions ?? []) out.push(serializeAction(action) + '\n')
  }
  for (const node of tree) {
    if (node.type === 'FLOW') {
      out.push(`# ${node.title}\n`)
      for (const child of node.children ?? []) writeStep(child)
    } else writeStep(node)
  }
  return out.join('\n')
}

function parseInfo(info: string): { word: string; attrs: Record<string, string> } {
  const word = info.match(/^[^\s]*/)?.[0] ?? ''
  const attrs: Record<string, string> = {}
  const regex = /([\w-]+)=("(?:[^"\\]|\\.)*"|[^\s]+)/g
  for (const match of info.slice(word.length).matchAll(regex)) {
    let value = match[2]
    if (value.startsWith('"')) {
      try {
        value = JSON.parse(value)
      } catch {
        value = value.slice(1, -1)
      }
    }
    attrs[match[1].toLowerCase()] = value
  }
  return { word: word.toLowerCase(), attrs }
}

function actionFromFence(info: string, body: string): StepAction {
  const { word, attrs } = parseInfo(info)
  const kind = KINDS.has(word) ? word : 'arquivo'
  const id = newId()
  switch (kind) {
    case 'terminal':
      return {
        id,
        kind: 'TERMINAL',
        command: body,
        executeImmediately: attrs.enter !== 'nao',
        typingAnimation: attrs.digitar !== 'nao',
        terminal: attrs.nome || undefined
      }
    case 'esperar':
      return {
        id,
        kind: 'WAIT',
        pattern: body.trim(),
        terminal: attrs.nome || undefined,
        timeoutSec: Number(attrs.tempo) || 60
      }
    case 'slide':
      return { id, kind: 'SLIDE', markdown: body, image: attrs.imagem || undefined }
    case 'destacar': {
      const [start, end] = (attrs.linhas ?? '1').split('-').map((n) => Number(n) || 1)
      return {
        id,
        kind: 'HIGHLIGHT',
        targetMode: attrs.arquivo ? 'SPECIFIC_PATH' : 'ACTIVE_FILE',
        targetPath: attrs.arquivo || undefined,
        startLine: start,
        endLine: end ?? start,
        note: body.trim()
      }
    }
    case 'desafio':
      return {
        id,
        kind: 'CHALLENGE',
        markdown: body,
        durationSec: Math.round((Number(attrs.tempo) || 0) * 60)
      }
    case 'preview':
      return { id, kind: 'PREVIEW', url: body.trim() }
    case 'obs':
      return { id, kind: 'OBS_SCENE', scene: body.trim() }
    default: {
      const operation = OPERATION_BY_NAME[attrs.operacao] ?? (attrs.arquivo ? 'CREATE' : 'APPEND')
      const action: FileAction = {
        ...(defaultAction('FILE', id) as FileAction),
        targetMode: attrs.arquivo ? 'SPECIFIC_PATH' : 'ACTIVE_FILE',
        targetPath: attrs.arquivo || undefined,
        operation,
        content: attrs['quebra-final'] === 'nao' ? body : `${body}\n`,
        replaceToken: attrs.texto || undefined
      }
      action.config = {
        animation: ANIMATION_BY_NAME[attrs.animacao] ?? 'TYPING',
        typingSpeedMs: Number(attrs.velocidade) || 30,
        language: word && word !== 'arquivo' && word !== 'text' ? word : undefined
      }
      return action
    }
  }
}

/** Parses a lesson written in the Markdown format above. */
export function parseLessonMarkdown(markdown: string): { title: string; tree: LessonNode[] } {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n')
  const tree: LessonNode[] = []
  let title = ''
  let flow: LessonNode | null = null
  let step: LessonNode | null = null
  let caption: string[] = []
  let notes: string[] = []

  const finishStep = (): void => {
    if (step?.data) {
      const text = caption.join('\n').trim()
      if (text) step.data.caption = text
      const note = notes.join('\n').trim()
      if (note) step.data.presenterNotes = note
    }
    caption = []
    notes = []
  }

  let i = 0
  if (lines[0]?.trim() === '---') {
    for (i = 1; i < lines.length && lines[i].trim() !== '---'; i++) {
      const m = /^(titulo|title)\s*:\s*(.*)$/i.exec(lines[i])
      if (m) title = m[2].trim()
    }
    i++
  }

  for (; i < lines.length; i++) {
    const line = lines[i]
    const fenceMatch = /^(`{3,}|~{3,})(.*)$/.exec(line)
    if (fenceMatch) {
      const marker = fenceMatch[1]
      const body: string[] = []
      for (i++; i < lines.length && !lines[i].startsWith(marker); i++) body.push(lines[i])
      if (!step) {
        // Content before the first "##": treat as its own step.
        if (!flow) {
          flow = {
            id: newId(),
            parentId: null,
            type: 'FLOW',
            title: 'Aula',
            isExpanded: true,
            children: []
          }
          tree.push(flow)
        }
        step = {
          id: newId(),
          parentId: flow.id,
          type: 'STEP',
          title: 'Passo',
          data: { actions: [] }
        }
        flow.children!.push(step)
      }
      step.data!.actions.push(actionFromFence(fenceMatch[2].trim(), body.join('\n')))
      continue
    }
    const heading = /^(#{1,2})\s+(.*)$/.exec(line)
    if (heading) {
      finishStep()
      if (heading[1] === '#') {
        flow = {
          id: newId(),
          parentId: null,
          type: 'FLOW',
          title: heading[2].replace(/^Fluxo:\s*/i, '').trim(),
          isExpanded: true,
          children: []
        }
        tree.push(flow)
        step = null
      } else {
        if (!flow) {
          flow = {
            id: newId(),
            parentId: null,
            type: 'FLOW',
            title: 'Aula',
            isExpanded: true,
            children: []
          }
          tree.push(flow)
        }
        step = {
          id: newId(),
          parentId: flow.id,
          type: 'STEP',
          title: heading[2].trim(),
          data: { actions: [] }
        }
        flow.children!.push(step)
      }
      continue
    }
    if (!step) continue
    if (line.startsWith('>'))
      notes.push(line.replace(/^>\s?/, '').replace(/^(\*\*)?Nota:(\*\*)?\s*/i, ''))
    else caption.push(line)
  }
  finishStep()
  return { title, tree }
}

const LANG_FOR_HANDOUT: Record<string, string> = { plaintext: 'text', shell: 'bash' }

/** Handout for students: captions, code and commands — no private notes. */
export function lessonToHandout(tree: LessonNode[], title: string, workspaceName: string): string {
  const out: string[] = [`# ${title || workspaceName}\n`]
  const steps = flattenSteps(tree)
  let currentFlow: string | null = null
  for (const [index, step] of steps.entries()) {
    const flow = tree.find((n) => n.children?.some((c) => c.id === step.id))
    if (flow && flow.id !== currentFlow) {
      currentFlow = flow.id
      out.push(`## ${flow.title}\n`)
    }
    out.push(`### ${index + 1}. ${step.title}\n`)
    if (step.data?.caption?.trim()) out.push(`${step.data.caption.trim()}\n`)
    for (const action of step.data?.actions ?? []) {
      switch (action.kind) {
        case 'FILE': {
          const file = action.targetPath ? `\`${action.targetPath}\`` : 'o arquivo aberto'
          const label: Record<FileOperation, string> = {
            CREATE: `Crie ${file}:`,
            APPEND: `Acrescente ao final de ${file}:`,
            PREPEND: `Adicione no início de ${file}:`,
            REPLACE_TOKEN: `Em ${file}, troque \`${action.replaceToken ?? ''}\` por:`,
            INSERT_AFTER: `Em ${file}, logo depois de \`${action.replaceToken ?? ''}\`, adicione:`,
            CURSOR_POSITION: `Em ${file}, adicione:`,
            OVERWRITE: `Substitua todo o conteúdo de ${file} por:`,
            DELETE: `Exclua ${file}.`
          }
          out.push(`**${label[action.operation]}**\n`)
          if (action.operation !== 'DELETE') {
            const language = action.config.language ?? languageFromPath(action.targetPath)
            out.push(
              fence(LANG_FOR_HANDOUT[language] ?? language, resolvePlaceholders(action.content)) +
                '\n'
            )
          }
          break
        }
        case 'TERMINAL':
          out.push('**No terminal:**\n')
          out.push(fence('bash', resolvePlaceholders(action.command)) + '\n')
          break
        case 'SLIDE':
          if (action.markdown.trim()) out.push(action.markdown.trim() + '\n')
          break
        case 'HIGHLIGHT':
          out.push(
            `> Observe as linhas ${action.startLine}–${action.endLine}${action.targetPath ? ` de \`${action.targetPath}\`` : ''}.${action.note ? ` ${action.note}` : ''}\n`
          )
          break
        case 'CHALLENGE':
          out.push(
            `**Desafio${action.durationSec ? ` (${Math.round(action.durationSec / 60)} min)` : ''}:**\n`
          )
          out.push(action.markdown.trim() + '\n')
          break
        case 'PREVIEW':
          out.push(`Abra no navegador: ${action.url}\n`)
          break
      }
    }
  }
  return out.join('\n')
}
