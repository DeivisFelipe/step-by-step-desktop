import {
  ConditionAction,
  ConditionTest,
  FileAction,
  FileAnimation,
  FileOperation,
  LabAction,
  LessonNode,
  StepAction
} from '../types/schema'
import { defaultAction, flattenSteps, newId, resolvePlaceholders } from './tree'
import { languageFromPath } from './paths'
import { SLIDE_TRANSITIONS, SlideTransition } from '../../../shared/presentation'

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
//   ```slide formato="html" transicao="zoom" telacheia="sim" → HTML slide
//   ```destacar arquivo="a.js" linhas="3-5"  → highlight (body = note)
//   ```desafio tempo="5"         → challenge (minutes; body = statement)
//   ```preview                   → preview (body = URL or file)
//   ```obs                       → OBS scene (body = scene name)
//   ```escolha titulo="…" variavel="trilha"  → menu; lines "Opção -> Título do passo"
//   ```se                        → if/else, one line per rule:
//                                  saida contem "ok" -> Passo · arquivo existe "a.php" -> Passo
//                                  arquivo contem "a.php" "echo" -> Passo
//                                  variavel trilha = "PHP" -> Passo · senao -> Passo
//   ```irpara                    → go to (body = step title)
//   ```laboratorio arquivo="a.php" layout="lado-a-lado"  → lab (body = ▶ command)

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
const KINDS = new Set([
  'terminal',
  'esperar',
  'slide',
  'destacar',
  'desafio',
  'preview',
  'obs',
  'escolha',
  'se',
  'irpara',
  'laboratorio'
])

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

function serializeAction(action: StepAction, titleOf: (id: string) => string | undefined): string {
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
    case 'SLIDE': {
      const options =
        attr('transicao', action.transition) +
        attr('telacheia', action.fullscreen === undefined ? '' : action.fullscreen ? 'sim' : 'nao')
      return action.format === 'html'
        ? fence('slide' + attr('formato', 'html') + options, action.html ?? '')
        : fence('slide' + attr('imagem', action.image) + options, action.markdown)
    }
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
    case 'CHOICE':
      return fence(
        'escolha' +
          attr('titulo', action.title) +
          attr('variavel', action.variable) +
          attr('palco', action.showOnStage ? '' : 'nao'),
        action.options.map((o) => o.label + arrow(o.target, titleOf)).join('\n')
      )
    case 'CONDITION':
      return fence(
        'se',
        [
          ...action.rules.map((r) => serializeTest(r.test) + arrow(r.target, titleOf)),
          ...(action.otherwise ? ['senao' + arrow(action.otherwise, titleOf)] : [])
        ].join('\n')
      )
    case 'GOTO':
      return fence('irpara', (action.target && titleOf(action.target)) || '')
    case 'LAB':
      return fence(
        'laboratorio' +
          attr('arquivo', action.targetMode === 'SPECIFIC_PATH' ? action.targetPath : '') +
          attr('layout', LAB_LAYOUTS[action.layout]) +
          attr('nome', action.terminal),
        action.command
      )
  }
}

const LAB_LAYOUTS: Record<LabAction['layout'], string> = {
  horizontal: 'lado-a-lado',
  vertical: 'empilhado',
  tabs: 'abas'
}
const LAB_LAYOUT_BY_NAME = invert(LAB_LAYOUTS)

/** " -> Step title" for a path target (nothing for "next of the list"). */
function arrow(target: string | undefined, titleOf: (id: string) => string | undefined): string {
  const title = target ? titleOf(target) : undefined
  return title ? ` -> ${title}` : ''
}

function serializeTest(test: ConditionTest): string {
  const q = (value: string): string => JSON.stringify(value)
  switch (test.type) {
    case 'output-contains':
      return `saida contem ${q(test.text)}` + (test.terminal ? ` terminal=${q(test.terminal)}` : '')
    case 'file-exists':
      return `arquivo existe ${q(test.path)}`
    case 'file-contains':
      return `arquivo contem ${q(test.path)} ${q(test.text)}`
    case 'variable-equals':
      return `variavel ${test.name} = ${q(test.value)}`
  }
}

/** Marks a target written as a step title; resolved to an id once all steps are known. */
const TITLE_REF = '\u0000'

/** Splits "text -> Step title" (also "→"); the target is kept as a title reference. */
function splitArrow(line: string): { text: string; target?: string } {
  const match = /^(.*?)\s*(?:->|→)\s*(.+)$/.exec(line)
  if (!match) return { text: line.trim() }
  return { text: match[1].trim(), target: TITLE_REF + match[2].trim() }
}

function parseTest(text: string): ConditionTest | null {
  const strings = [...text.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => {
    try {
      return JSON.parse(`"${m[1]}"`) as string
    } catch {
      return m[1]
    }
  })
  const lower = text.toLowerCase()
  if (lower.startsWith('saida contem') || lower.startsWith('saída contém')) {
    const terminal = /terminal="((?:[^"\\]|\\.)*)"/.exec(text)?.[1]
    return { type: 'output-contains', text: strings[0] ?? '', terminal: terminal || undefined }
  }
  if (lower.startsWith('arquivo existe')) return { type: 'file-exists', path: strings[0] ?? '' }
  if (lower.startsWith('arquivo contem') || lower.startsWith('arquivo contém')) {
    return { type: 'file-contains', path: strings[0] ?? '', text: strings[1] ?? '' }
  }
  const variable = /^vari[aá]vel\s+([\w.-]+)\s*=/i.exec(text)
  if (variable) return { type: 'variable-equals', name: variable[1], value: strings[0] ?? '' }
  return null
}

/** Replaces title references (from the Markdown) with step ids. */
function resolveTargets(tree: LessonNode[]): void {
  const byTitle = new Map<string, string>()
  for (const step of flattenSteps(tree)) {
    const key = step.title.trim().toLowerCase()
    if (!byTitle.has(key)) byTitle.set(key, step.id)
  }
  const resolve = (target: string | undefined): string | undefined =>
    target?.startsWith(TITLE_REF)
      ? byTitle.get(target.slice(TITLE_REF.length).trim().toLowerCase())
      : target
  for (const step of flattenSteps(tree)) {
    for (const action of step.data?.actions ?? []) {
      if (action.kind === 'CHOICE') {
        action.options = action.options.map((o) => ({ ...o, target: resolve(o.target) }))
      } else if (action.kind === 'CONDITION') {
        action.rules = action.rules.map((r) => ({ ...r, target: resolve(r.target) }))
        action.otherwise = resolve(action.otherwise)
      } else if (action.kind === 'GOTO') {
        action.target = resolve(action.target)
      }
    }
  }
}

/** The whole lesson as editable Markdown (round-trips through `parseLessonMarkdown`). */
export function lessonToMarkdown(tree: LessonNode[], title: string): string {
  const out: string[] = []
  const titles = new Map(flattenSteps(tree).map((s) => [s.id, s.title]))
  const titleOf = (id: string): string | undefined => titles.get(id)
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
    for (const action of step.data?.actions ?? []) {
      out.push(serializeAction(action, titleOf) + '\n')
    }
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
    case 'slide': {
      const options = {
        transition: SLIDE_TRANSITIONS.some((t) => t.value === attrs.transicao)
          ? (attrs.transicao as SlideTransition)
          : undefined,
        fullscreen: attrs.telacheia ? attrs.telacheia === 'sim' : undefined
      }
      return attrs.formato === 'html'
        ? { id, kind: 'SLIDE', format: 'html', markdown: '', html: body, ...options }
        : { id, kind: 'SLIDE', markdown: body, image: attrs.imagem || undefined, ...options }
    }
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
    case 'escolha':
      return {
        id,
        kind: 'CHOICE',
        title: attrs.titulo ?? '',
        variable: attrs.variavel || undefined,
        showOnStage: attrs.palco !== 'nao',
        options: body
          .split('\n')
          .filter((l) => l.trim())
          .map((line) => {
            const { text, target } = splitArrow(line)
            return { id: newId(), label: text, target }
          })
      }
    case 'se': {
      const action: ConditionAction = { id, kind: 'CONDITION', rules: [] }
      for (const line of body.split('\n').filter((l) => l.trim())) {
        const { text, target } = splitArrow(line)
        if (/^sen[aã]o$/i.test(text)) {
          action.otherwise = target
          continue
        }
        const test = parseTest(text)
        if (test) action.rules.push({ id: newId(), test, target })
      }
      return action
    }
    case 'irpara':
      return {
        id,
        kind: 'GOTO',
        target: body.trim() ? TITLE_REF + body.trim() : undefined
      }
    case 'laboratorio':
      return {
        id,
        kind: 'LAB',
        targetMode: attrs.arquivo ? 'SPECIFIC_PATH' : 'ACTIVE_FILE',
        targetPath: attrs.arquivo || undefined,
        layout: LAB_LAYOUT_BY_NAME[attrs.layout] ?? 'horizontal',
        terminal: attrs.nome || undefined,
        command: body.trim()
      }
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
  resolveTargets(tree)
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
          // Slide headings become small headings so they don't break the handout outline.
          if (action.markdown.trim()) {
            const demoted = action.markdown
              .trim()
              .replace(
                /^(#{1,6})\s+(.*)$/gm,
                (_m, hashes: string, text: string) =>
                  `${'#'.repeat(Math.min(6, hashes.length + 3))} ${text}`
              )
            out.push(demoted + '\n')
          }
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
        case 'LAB':
          out.push(
            `**Experimente:** mude${action.targetPath ? ` \`${action.targetPath}\`` : ' o código'} e rode:\n`
          )
          out.push(fence('bash', resolvePlaceholders(action.command)) + '\n')
          break
        case 'CHOICE':
          if (action.options.length) {
            out.push(
              `**${action.title.trim() || 'Escolha'}** ${action.options.map((o) => o.label).join(' · ')}\n`
            )
          }
          break
      }
    }
  }
  return out.join('\n')
}
