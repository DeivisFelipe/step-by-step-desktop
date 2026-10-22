import { useEffect, useState } from 'react'
import clsx from 'clsx'
import Editor from '@monaco-editor/react'
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Loader2,
  Play,
  Plus,
  StepForward,
  Trash,
  X
} from 'lucide-react'
import { useLessonStore } from '../../store/useLessonStore'
import { useFileSystemStore } from '../../store/useFileSystemStore'
import { usePlayerStore } from '../../store/usePlayerStore'
import { useTerminalStore } from '../../store/useTerminalStore'
import { useSettingsStore } from '../../store/useSettingsStore'
import {
  ActionKind,
  ChallengeAction,
  ChoiceAction,
  ChoiceOption,
  ConditionAction,
  ConditionRule,
  ConditionTest,
  FileAction,
  FileAnimation,
  FileOperation,
  FileTarget,
  GotoAction,
  HighlightAction,
  LabAction,
  LessonNode,
  ObsSceneAction,
  PreviewAction,
  SlideAction,
  StepAction,
  TerminalAction,
  WaitAction
} from '../../types/schema'
import {
  ACTION_LABELS,
  findNode,
  findPlaceholders,
  flattenSteps,
  flowOf,
  newId,
  resolvePlaceholders
} from '../../lib/tree'
import { SLIDE_TRANSITIONS, SlideTransition } from '../../../../shared/presentation'
import { languageFromPath } from '../../lib/paths'
import { describeAction, resolveAssetUrl } from '../../engine/ExecutionEngine'
import { deleteNode } from '../../lib/lessonActions'
import { EDITOR_OPTIONS } from '../../lib/monaco'
import { ActionIcon } from '../UI/ActionIcon'
import { Markdown, SlideView } from '../../../common/StageViews'

const OPERATIONS: { value: FileOperation; label: string }[] = [
  { value: 'CREATE', label: 'Criar arquivo' },
  { value: 'APPEND', label: 'Acrescentar ao final' },
  { value: 'PREPEND', label: 'Inserir no início' },
  { value: 'REPLACE_TOKEN', label: 'Substituir texto' },
  { value: 'INSERT_AFTER', label: 'Inserir depois de um texto' },
  { value: 'CURSOR_POSITION', label: 'Inserir no cursor' },
  { value: 'OVERWRITE', label: 'Sobrescrever arquivo' },
  { value: 'DELETE', label: 'Excluir arquivo' }
]

const ANIMATIONS: { value: FileAnimation; label: string }[] = [
  { value: 'TYPING', label: 'Digitação' },
  { value: 'MORPH', label: 'Transformação suave (magic move)' },
  { value: 'NONE', label: 'Sem animação' }
]

const LANGUAGES = [
  'plaintext',
  'javascript',
  'typescript',
  'python',
  'java',
  'c',
  'cpp',
  'csharp',
  'go',
  'php',
  'html',
  'css',
  'json',
  'sql',
  'markdown',
  'shell'
]

const ADDABLE: ActionKind[] = [
  'FILE',
  'TERMINAL',
  'HIGHLIGHT',
  'SLIDE',
  'CHALLENGE',
  'WAIT',
  'PREVIEW',
  'OBS_SCENE',
  'LAB',
  'CHOICE',
  'CONDITION',
  'GOTO'
]

const input =
  'rounded border border-ide-border bg-ide-input px-2 py-1.5 text-[13px] text-white outline-none focus:border-ide-accent'
const labelClass = 'mb-1 block text-[12px] font-semibold text-gray-400'

const Field = ({
  title,
  hint,
  children,
  className
}: {
  title: string
  hint?: React.ReactNode
  children: React.ReactNode
  className?: string
}): React.JSX.Element => (
  <div className={className}>
    <label className={labelClass}>{title}</label>
    {children}
    {hint && <p className="mt-1 text-[11px] text-ide-muted">{hint}</p>}
  </div>
)

const Check = ({
  checked,
  onChange,
  children
}: {
  checked: boolean
  onChange: (value: boolean) => void
  children: React.ReactNode
}): React.JSX.Element => (
  <label className="flex cursor-pointer items-center gap-2 text-[13px] text-gray-300">
    <input
      type="checkbox"
      className="accent-sky-500"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
    />
    {children}
  </label>
)

const SpeedSlider = ({
  value,
  onChange
}: {
  value: number
  onChange: (value: number) => void
}): React.JSX.Element => (
  <div className="flex items-center gap-3 text-[12px] text-gray-400">
    <span>Rápido</span>
    <input
      type="range"
      min={5}
      max={150}
      step={5}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="flex-1 accent-sky-500"
    />
    <span>Lento</span>
    <span className="w-14 text-right tabular-nums">{value} ms</span>
  </div>
)

const Placeholders = ({
  text,
  onChange
}: {
  text: string
  onChange: (text: string) => void
}): React.JSX.Element | null => {
  const placeholders = findPlaceholders(text)
  if (placeholders.length === 0) return null

  const setValue = (index: number, value: string): void => {
    const p = placeholders[index]
    const replacement = `[[${p.key}:${value.replace(/[\]]/g, '')}]]`
    onChange(text.slice(0, p.index) + replacement + text.slice(p.index + p.raw.length))
  }

  return (
    <div className="rounded border border-ide-border bg-ide-bg p-3">
      <div className="mb-2 text-[12px] font-semibold text-gray-400">Variáveis</div>
      <div className="grid grid-cols-2 gap-3">
        {placeholders.map((p, i) => (
          <Field key={`${p.key}-${i}`} title={p.key}>
            <input
              className={clsx(input, 'w-full font-mono')}
              value={p.value}
              onChange={(e) => setValue(i, e.target.value)}
            />
          </Field>
        ))}
      </div>
    </div>
  )
}

/** Target file selector shared by file and highlight actions. */
const TargetFields = ({
  target,
  update,
  forcePath
}: {
  target: FileTarget
  update: (partial: Partial<FileTarget>) => void
  forcePath?: boolean
}): React.JSX.Element => {
  const usesPath = forcePath || target.targetMode === 'SPECIFIC_PATH'
  return (
    <div className="grid grid-cols-2 gap-4">
      {!forcePath && (
        <Field title="Arquivo alvo">
          <select
            className={clsx(input, 'w-full')}
            value={target.targetMode}
            onChange={(e) => update({ targetMode: e.target.value as FileTarget['targetMode'] })}
          >
            <option value="SPECIFIC_PATH">Caminho específico</option>
            <option value="ACTIVE_FILE">Arquivo aberto no editor</option>
          </select>
        </Field>
      )}
      {usesPath && (
        <Field
          title="Caminho do arquivo"
          hint="Relativo à pasta aberta."
          className={forcePath ? 'col-span-2' : ''}
        >
          <input
            className={clsx(input, 'w-full font-mono')}
            value={target.targetPath ?? ''}
            placeholder="src/index.js"
            onChange={(e) => update({ targetPath: e.target.value })}
            spellCheck={false}
          />
        </Field>
      )}
    </div>
  )
}

type FormProps<T extends StepAction> = {
  step: LessonNode
  action: T
  update: (partial: Partial<T>) => void
}

const FileActionForm = ({ step, action, update }: FormProps<FileAction>): React.JSX.Element => {
  const updateConfig = (partial: Partial<FileAction['config']>): void =>
    update({ config: { ...action.config, ...partial } })
  const isCreate = action.operation === 'CREATE'
  const usesPath = isCreate || action.targetMode === 'SPECIFIC_PATH'
  const language =
    action.config.language || (usesPath ? languageFromPath(action.targetPath) : 'plaintext')

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field title="Operação">
          <select
            className={clsx(input, 'w-full')}
            value={action.operation}
            onChange={(e) => update({ operation: e.target.value as FileOperation })}
          >
            {OPERATIONS.map((op) => (
              <option key={op.value} value={op.value}>
                {op.label}
              </option>
            ))}
          </select>
        </Field>
        {action.operation !== 'DELETE' && (
          <Field title="Animação">
            <select
              className={clsx(input, 'w-full')}
              value={action.config.animation}
              onChange={(e) => updateConfig({ animation: e.target.value as FileAnimation })}
            >
              {ANIMATIONS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>

      <TargetFields target={action} update={update} forcePath={isCreate} />

      {(action.operation === 'REPLACE_TOKEN' || action.operation === 'INSERT_AFTER') && (
        <Field
          title={action.operation === 'REPLACE_TOKEN' ? 'Texto a substituir' : 'Inserir depois de'}
          hint={
            action.operation === 'REPLACE_TOKEN'
              ? 'A primeira ocorrência deste texto é trocada pelo conteúdo.'
              : 'O conteúdo é digitado logo após a primeira ocorrência deste texto.'
          }
        >
          <input
            className={clsx(input, 'w-full font-mono')}
            value={action.replaceToken ?? ''}
            placeholder="// TODO"
            onChange={(e) => update({ replaceToken: e.target.value })}
            spellCheck={false}
          />
        </Field>
      )}

      {action.operation !== 'DELETE' && (
        <>
          {action.config.animation === 'TYPING' && (
            <SpeedSlider
              value={action.config.typingSpeedMs ?? 30}
              onChange={(typingSpeedMs) => updateConfig({ typingSpeedMs })}
            />
          )}
          <Field
            title="Conteúdo"
            hint={
              <>
                Use <code className="text-gray-300">[[Nome:valor]]</code> para criar variáveis
                ajustáveis antes de executar.
              </>
            }
          >
            <div className="mb-1 flex justify-end">
              <select
                className="rounded border border-ide-border bg-ide-input px-1 py-0.5 text-[11px] text-gray-300 outline-none"
                value={language}
                onChange={(e) => updateConfig({ language: e.target.value })}
                title="Linguagem (apenas para o realce de sintaxe)"
              >
                {[...new Set([language, ...LANGUAGES])].map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className="h-64 overflow-hidden rounded border border-ide-border">
              <Editor
                height="100%"
                theme="vs-dark"
                path={`ssc-step://${step.id}/${action.id}`}
                language={language}
                value={action.content}
                onChange={(value) => update({ content: value ?? '' })}
                options={{ ...EDITOR_OPTIONS, fontSize: 13, lineNumbersMinChars: 3 }}
              />
            </div>
          </Field>
          <Placeholders text={action.content} onChange={(content) => update({ content })} />
        </>
      )}
    </div>
  )
}

const TerminalNameField = ({
  value,
  onChange
}: {
  value: string | undefined
  onChange: (value: string) => void
}): React.JSX.Element => {
  const sessions = useTerminalStore((s) => s.sessions)
  return (
    <Field title="Terminal" hint="Vazio usa o terminal ativo. Um nome novo cria outro terminal.">
      <input
        className={clsx(input, 'w-full')}
        list="ssc-terminal-names"
        value={value ?? ''}
        placeholder="Terminal ativo"
        onChange={(e) => onChange(e.target.value)}
      />
      <datalist id="ssc-terminal-names">
        {sessions.map((s) => (
          <option key={s.key} value={s.name} />
        ))}
      </datalist>
    </Field>
  )
}

const TerminalActionForm = ({ action, update }: FormProps<TerminalAction>): React.JSX.Element => (
  <div className="space-y-4">
    <Field title="Comando" hint="Cada linha é enviada como um comando separado.">
      <textarea
        className={clsx(input, 'h-20 w-full resize-y font-mono')}
        value={action.command}
        placeholder="npm install"
        onChange={(e) => update({ command: e.target.value })}
        spellCheck={false}
      />
    </Field>
    <TerminalNameField value={action.terminal} onChange={(terminal) => update({ terminal })} />
    <div className="space-y-2">
      <Check
        checked={action.executeImmediately}
        onChange={(executeImmediately) => update({ executeImmediately })}
      >
        Executar automaticamente (pressiona Enter)
      </Check>
      <Check
        checked={action.typingAnimation !== false}
        onChange={(typingAnimation) => update({ typingAnimation })}
      >
        Digitação animada
      </Check>
      <Check
        checked={action.pauseBefore !== false}
        onChange={(pauseBefore) => update({ pauseBefore })}
      >
        Esperar F8 antes de rodar, quando o passo mostrou código antes (dá tempo de explicar o
        código)
      </Check>
      {action.typingAnimation !== false && (
        <SpeedSlider
          value={action.typingSpeedMs ?? 35}
          onChange={(typingSpeedMs) => update({ typingSpeedMs })}
        />
      )}
    </div>
    <Placeholders text={action.command} onChange={(command) => update({ command })} />
  </div>
)

const WaitActionForm = ({ action, update }: FormProps<WaitAction>): React.JSX.Element => (
  <div className="grid grid-cols-2 gap-4">
    <Field
      title="Esperar aparecer"
      hint="Texto (sem diferenciar maiúsculas) ou /regex/. Esc pula a espera."
      className="col-span-2"
    >
      <input
        className={clsx(input, 'w-full font-mono')}
        value={action.pattern}
        placeholder="ready in"
        onChange={(e) => update({ pattern: e.target.value })}
        spellCheck={false}
      />
    </Field>
    <TerminalNameField value={action.terminal} onChange={(terminal) => update({ terminal })} />
    <Field title="Tempo máximo (segundos)">
      <input
        type="number"
        min={1}
        className={clsx(input, 'w-full')}
        value={action.timeoutSec}
        onChange={(e) => update({ timeoutSec: Number(e.target.value) || 60 })}
      />
    </Field>
  </div>
)

const HTML_SLIDE_TEMPLATE = `<style>
  body {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 40px;
    background: radial-gradient(circle at 30% 20%, #4f46e5, #0f172a 70%);
  }
  h1 {
    margin: 0;
    font-size: 120px;
    animation: entrar 900ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
  }
  p {
    margin: 0;
    font-size: 48px;
    opacity: 0.85;
    animation: entrar 900ms 300ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
  }
  @keyframes entrar {
    from {
      opacity: 0;
      transform: translateY(60px);
    }
  }
</style>

<h1>Título do slide</h1>
<p>Feito em HTML, com animação</p>
`

/** Serves the HTML being edited (debounced) and returns its path on the presentation server. */
function useHtmlSlidePath(html: string): string | null {
  const [path, setPath] = useState<string | null>(null)
  useEffect(() => {
    if (!html.trim()) return
    const timer = setTimeout(() => {
      window.api.registerSlide(resolvePlaceholders(html)).then(setPath)
    }, 300)
    return () => clearTimeout(timer)
  }, [html])
  return html.trim() ? path : null
}

const SlideActionForm = ({ action, update }: FormProps<SlideAction>): React.JSX.Element => {
  const html = action.format === 'html'
  const htmlPath = useHtmlSlidePath(html ? (action.html ?? '') : '')
  const server = useSettingsStore((s) => s.server?.localUrl ?? '')
  const tab = (active: boolean): string =>
    clsx(
      'rounded px-3 py-1 text-[12px]',
      active ? 'bg-ide-accent text-white' : 'bg-ide-input text-gray-300 hover:bg-ide-border'
    )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button className={tab(!html)} onClick={() => update({ format: 'markdown' })}>
          Markdown
        </button>
        <button
          className={tab(html)}
          onClick={() =>
            update({
              format: 'html',
              html: action.html?.trim() ? action.html : HTML_SLIDE_TEMPLATE
            })
          }
        >
          HTML
        </button>
        <span className="text-[11px] text-ide-muted">
          {html
            ? 'Página própria em 1920×1080: pode usar <style>, <script> e animações CSS.'
            : 'Texto formatado; diminui sozinho para caber.'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {html ? (
          <Field
            title="HTML"
            hint="Arquivos da pasta aberta por caminho relativo (ex.: imagens/foto.png)."
          >
            <textarea
              className={clsx(input, 'h-64 w-full resize-y font-mono')}
              value={action.html ?? ''}
              onChange={(e) => update({ html: e.target.value })}
              spellCheck={false}
            />
          </Field>
        ) : (
          <Field title="Conteúdo (Markdown)">
            <textarea
              className={clsx(input, 'h-48 w-full resize-y font-mono')}
              value={action.markdown}
              onChange={(e) => update({ markdown: e.target.value })}
            />
          </Field>
        )}
        <Field title="Prévia">
          <div
            className={clsx(
              'overflow-hidden rounded border border-ide-border bg-[#111827] text-white',
              html ? 'aspect-video' : 'h-48'
            )}
          >
            {html ? (
              htmlPath && <SlideView slide={{ markdown: '', htmlPath }} server={server} />
            ) : (
              <SlideView
                slide={{ markdown: action.markdown, image: resolveAssetUrl(action.image) }}
                fontSize={11}
              />
            )}
          </div>
        </Field>
      </div>

      {!html && (
        <Field title="Imagem (opcional)" hint="Caminho relativo à pasta aberta ou URL.">
          <input
            className={clsx(input, 'w-full font-mono')}
            value={action.image ?? ''}
            placeholder="imagens/diagrama.png"
            onChange={(e) => update({ image: e.target.value })}
            spellCheck={false}
          />
        </Field>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field title="Transição" hint="Animação ao entrar este slide.">
          <select
            className={clsx(input, 'w-full')}
            value={action.transition ?? ''}
            onChange={(e) =>
              update({ transition: (e.target.value || undefined) as SlideTransition | undefined })
            }
          >
            <option value="">Padrão do estilo</option>
            {SLIDE_TRANSITIONS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <Field title="Tela cheia" hint="Ocupa a página inteira do palco, sem margens.">
          <select
            className={clsx(input, 'w-full')}
            value={action.fullscreen === undefined ? '' : action.fullscreen ? 'sim' : 'nao'}
            onChange={(e) =>
              update({ fullscreen: e.target.value ? e.target.value === 'sim' : undefined })
            }
          >
            <option value="">Padrão do estilo</option>
            <option value="sim">Sim</option>
            <option value="nao">Não</option>
          </select>
        </Field>
      </div>
    </div>
  )
}

const HighlightActionForm = ({ action, update }: FormProps<HighlightAction>): React.JSX.Element => (
  <div className="space-y-4">
    <TargetFields target={action} update={update} />
    <div className="grid grid-cols-2 gap-4">
      <Field title="Da linha">
        <input
          type="number"
          min={1}
          className={clsx(input, 'w-full')}
          value={action.startLine}
          onChange={(e) => update({ startLine: Number(e.target.value) || 1 })}
        />
      </Field>
      <Field title="Até a linha">
        <input
          type="number"
          min={1}
          className={clsx(input, 'w-full')}
          value={action.endLine}
          onChange={(e) => update({ endLine: Number(e.target.value) || 1 })}
        />
      </Field>
    </div>
    <Field title="Explicação (opcional)" hint="Aparece num balão junto às linhas destacadas.">
      <textarea
        className={clsx(input, 'h-16 w-full resize-y')}
        value={action.note ?? ''}
        onChange={(e) => update({ note: e.target.value })}
      />
    </Field>
  </div>
)

const ChallengeActionForm = ({ action, update }: FormProps<ChallengeAction>): React.JSX.Element => (
  <div className="grid grid-cols-3 gap-4">
    <Field title="Enunciado (Markdown)" className="col-span-2">
      <textarea
        className={clsx(input, 'h-36 w-full resize-y font-mono')}
        value={action.markdown}
        onChange={(e) => update({ markdown: e.target.value })}
      />
    </Field>
    <Field title="Tempo (minutos)" hint="0 = sem cronômetro.">
      <input
        type="number"
        min={0}
        step={0.5}
        className={clsx(input, 'w-full')}
        value={action.durationSec / 60}
        onChange={(e) => update({ durationSec: Math.round((Number(e.target.value) || 0) * 60) })}
      />
    </Field>
  </div>
)

const PreviewActionForm = ({ action, update }: FormProps<PreviewAction>): React.JSX.Element => (
  <Field
    title="Endereço"
    hint="URL (ex.: http://localhost:5173) ou arquivo da pasta aberta (ex.: index.html)."
  >
    <input
      className={clsx(input, 'w-full font-mono')}
      value={action.url}
      onChange={(e) => update({ url: e.target.value })}
      spellCheck={false}
    />
  </Field>
)

const ObsSceneActionForm = ({ action, update }: FormProps<ObsSceneAction>): React.JSX.Element => {
  const scenes = useSettingsStore((s) => s.obs?.scenes ?? [])
  return (
    <Field title="Cena do OBS" hint="Troca a cena no OBS. Configure a conexão na aba Apresentação.">
      <input
        className={clsx(input, 'w-full')}
        list="ssc-obs-scenes"
        value={action.scene}
        onChange={(e) => update({ scene: e.target.value })}
      />
      <datalist id="ssc-obs-scenes">
        {scenes.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </Field>
  )
}

/** Picks the step a path leads to; empty = the next step of the list. */
const StepPicker = ({
  value,
  onChange,
  exclude
}: {
  value: string | undefined
  onChange: (value: string | undefined) => void
  exclude?: string
}): React.JSX.Element => {
  const tree = useLessonStore((s) => s.tree)
  const steps = flattenSteps(tree)
  const missing = value && !steps.some((s) => s.id === value)
  return (
    <select
      className={clsx(input, 'w-full')}
      value={missing ? '' : (value ?? '')}
      onChange={(e) => onChange(e.target.value || undefined)}
    >
      <option value="">Próximo passo da lista</option>
      {steps.map((s, i) =>
        s.id === exclude ? null : (
          <option key={s.id} value={s.id}>
            {i + 1}. {s.title}
            {flowOf(tree, s) ? ` (${flowOf(tree, s)!.title})` : ''}
          </option>
        )
      )}
    </select>
  )
}

const ChoiceActionForm = ({ step, action, update }: FormProps<ChoiceAction>): React.JSX.Element => {
  const setOption = (id: string, partial: Partial<ChoiceOption>): void =>
    update({ options: action.options.map((o) => (o.id === id ? { ...o, ...partial } : o)) })
  return (
    <div className="space-y-4">
      <Field title="Pergunta" hint="Aparece acima das opções.">
        <input
          className={clsx(input, 'w-full')}
          value={action.title}
          onChange={(e) => update({ title: e.target.value })}
        />
      </Field>
      <div className="space-y-2">
        <div className={labelClass}>Opções (tecla, texto do botão e passo de destino)</div>
        {action.options.map((option, i) => (
          <div key={option.id} className="flex items-center gap-2">
            <span className="w-5 text-right text-[12px] tabular-nums text-ide-muted">{i + 1}</span>
            <input
              className={clsx(input, 'flex-1')}
              value={option.label}
              placeholder="Texto do botão"
              onChange={(e) => setOption(option.id, { label: e.target.value })}
            />
            <div className="w-[45%]">
              <StepPicker
                value={option.target}
                exclude={step.id}
                onChange={(target) => setOption(option.id, { target })}
              />
            </div>
            <button
              className="rounded p-1 text-gray-400 hover:bg-ide-hover hover:text-red-400"
              title="Remover opção"
              onClick={() => update({ options: action.options.filter((o) => o.id !== option.id) })}
            >
              <X size={14} />
            </button>
          </div>
        ))}
        <button
          className="flex items-center gap-1 text-[12px] text-sky-400 hover:text-sky-300"
          onClick={() =>
            update({
              options: [
                ...action.options,
                { id: newId(), label: `Opção ${String.fromCharCode(65 + action.options.length)}` }
              ]
            })
          }
        >
          <Plus size={13} /> Adicionar opção
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field
          title="Guardar a escolha na variável"
          hint="Opcional. Um “Se / senão” mais adiante pode testar o valor."
        >
          <input
            className={clsx(input, 'w-full font-mono')}
            value={action.variable ?? ''}
            placeholder="escolha"
            onChange={(e) => update({ variable: e.target.value })}
            spellCheck={false}
          />
        </Field>
        <div className="pt-6">
          <Check checked={action.showOnStage} onChange={(showOnStage) => update({ showOnStage })}>
            Mostrar o menu para a turma (palco e OBS)
          </Check>
        </div>
      </div>
      <p className="text-[11px] text-ide-muted">
        Durante a aula o passo espera a escolha: clique na opção, aperte 1–
        {Math.max(1, action.options.length)}, use a visão do apresentador ou chame{' '}
        <code>proximoPasso(0)</code> num slide em HTML (0 = primeira opção). O passo escolhido roda
        em seguida.
      </p>
    </div>
  )
}

const CONDITION_TYPES: { value: ConditionTest['type']; label: string }[] = [
  { value: 'output-contains', label: 'A saída do terminal contém' },
  { value: 'file-exists', label: 'O arquivo existe' },
  { value: 'file-contains', label: 'O arquivo contém' },
  { value: 'variable-equals', label: 'A variável é igual a' }
]

function emptyTest(type: ConditionTest['type']): ConditionTest {
  switch (type) {
    case 'output-contains':
      return { type, text: '' }
    case 'file-exists':
      return { type, path: '' }
    case 'file-contains':
      return { type, path: '', text: '' }
    case 'variable-equals':
      return { type, name: '', value: '' }
  }
}

const ConditionTestFields = ({
  test,
  onChange
}: {
  test: ConditionTest
  onChange: (test: ConditionTest) => void
}): React.JSX.Element => {
  const text = (
    placeholder: string,
    value: string,
    set: (v: string) => void
  ): React.JSX.Element => (
    <input
      className={clsx(input, 'min-w-0 flex-1 font-mono')}
      value={value}
      placeholder={placeholder}
      onChange={(e) => set(e.target.value)}
      spellCheck={false}
    />
  )
  switch (test.type) {
    case 'output-contains':
      return (
        <>
          {text('texto ou /regex/', test.text, (v) => onChange({ ...test, text: v }))}
          {text('terminal (vazio = ativo)', test.terminal ?? '', (v) =>
            onChange({ ...test, terminal: v || undefined })
          )}
        </>
      )
    case 'file-exists':
      return text('caminho/do/arquivo', test.path, (v) => onChange({ ...test, path: v }))
    case 'file-contains':
      return (
        <>
          {text('caminho/do/arquivo', test.path, (v) => onChange({ ...test, path: v }))}
          {text('texto ou /regex/', test.text, (v) => onChange({ ...test, text: v }))}
        </>
      )
    case 'variable-equals':
      return (
        <>
          {text('variável', test.name, (v) => onChange({ ...test, name: v }))}
          {text('valor', test.value, (v) => onChange({ ...test, value: v }))}
        </>
      )
  }
}

const ConditionActionForm = ({
  step,
  action,
  update
}: FormProps<ConditionAction>): React.JSX.Element => {
  const setRule = (id: string, partial: Partial<ConditionRule>): void =>
    update({ rules: action.rules.map((r) => (r.id === id ? { ...r, ...partial } : r)) })
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-ide-muted">
        Testadas em ordem: a primeira que for verdadeira decide o próximo passo. A saída do terminal
        é a do último comando rodado nele.
      </p>
      {action.rules.map((rule, i) => (
        <div key={rule.id} className="space-y-2 rounded border border-ide-border bg-ide-bg p-3">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold text-amber-400">
              {i === 0 ? 'Se' : 'Senão, se'}
            </span>
            <select
              className={clsx(input, 'w-56')}
              value={rule.test.type}
              onChange={(e) =>
                setRule(rule.id, { test: emptyTest(e.target.value as ConditionTest['type']) })
              }
            >
              {CONDITION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <ConditionTestFields test={rule.test} onChange={(test) => setRule(rule.id, { test })} />
            <button
              className="rounded p-1 text-gray-400 hover:bg-ide-hover hover:text-red-400"
              title="Remover condição"
              onClick={() => update({ rules: action.rules.filter((r) => r.id !== rule.id) })}
            >
              <X size={14} />
            </button>
          </div>
          <div className="flex items-center gap-2 text-[12px] text-gray-400">
            <span className="w-20 text-right">então vai para</span>
            <StepPicker
              value={rule.target}
              exclude={step.id}
              onChange={(target) => setRule(rule.id, { target })}
            />
          </div>
        </div>
      ))}
      <button
        className="flex items-center gap-1 text-[12px] text-sky-400 hover:text-sky-300"
        onClick={() =>
          update({
            rules: [...action.rules, { id: newId(), test: { type: 'output-contains', text: '' } }]
          })
        }
      >
        <Plus size={13} /> Adicionar condição
      </button>
      <div className="flex items-center gap-2 text-[12px] text-gray-400">
        <span className="font-semibold text-amber-400">Senão</span>
        <span>vai para</span>
        <StepPicker
          value={action.otherwise}
          exclude={step.id}
          onChange={(otherwise) => update({ otherwise })}
        />
      </div>
    </div>
  )
}

const GotoActionForm = ({ step, action, update }: FormProps<GotoAction>): React.JSX.Element => (
  <Field
    title="Depois deste passo, ir para"
    hint="Use no fim de um caminho de menu para voltar ao caminho principal, ou para repetir passos."
  >
    <StepPicker value={action.target} exclude={step.id} onChange={(target) => update({ target })} />
  </Field>
)

const LabActionForm = ({ action, update }: FormProps<LabAction>): React.JSX.Element => (
  <div className="space-y-4">
    <TargetFields target={action} update={update} />
    <div className="grid grid-cols-2 gap-4">
      <Field title="Comando do ▶" hint="Roda no terminal a cada clique (ou Ctrl+Enter).">
        <input
          className={clsx(input, 'w-full font-mono')}
          value={action.command}
          placeholder="php index.php"
          onChange={(e) => update({ command: e.target.value })}
          spellCheck={false}
        />
      </Field>
      <TerminalNameField value={action.terminal} onChange={(terminal) => update({ terminal })} />
    </div>
    <Field title="No palco" hint="Como o código e o terminal aparecem para a turma.">
      <select
        className={clsx(input, 'w-full')}
        value={action.layout}
        onChange={(e) => update({ layout: e.target.value as LabAction['layout'] })}
      >
        <option value="horizontal">Lado a lado (código à esquerda, terminal à direita)</option>
        <option value="vertical">Empilhados (código em cima, terminal embaixo)</option>
        <option value="tabs">Abas (mostra o terminal ao rodar e o código ao editar)</option>
      </select>
    </Field>
    <p className="text-[11px] text-ide-muted">
      Durante a aula o arquivo abre no editor para você mudar o código ao vivo. ▶ (ou Ctrl+Enter)
      salva e roda o comando quantas vezes quiser; F8 continua a aula. Voltar o passo desfaz as
      edições.
    </p>
  </div>
)

const ActionForm = ({
  step,
  action
}: {
  step: LessonNode
  action: StepAction
}): React.JSX.Element => {
  const update = (partial: Partial<StepAction>): void =>
    useLessonStore.getState().updateAction(step.id, action.id, partial)
  switch (action.kind) {
    case 'FILE':
      return <FileActionForm step={step} action={action} update={update} />
    case 'TERMINAL':
      return <TerminalActionForm step={step} action={action} update={update} />
    case 'WAIT':
      return <WaitActionForm step={step} action={action} update={update} />
    case 'SLIDE':
      return <SlideActionForm step={step} action={action} update={update} />
    case 'HIGHLIGHT':
      return <HighlightActionForm step={step} action={action} update={update} />
    case 'CHALLENGE':
      return <ChallengeActionForm step={step} action={action} update={update} />
    case 'PREVIEW':
      return <PreviewActionForm step={step} action={action} update={update} />
    case 'OBS_SCENE':
      return <ObsSceneActionForm step={step} action={action} update={update} />
    case 'CHOICE':
      return <ChoiceActionForm step={step} action={action} update={update} />
    case 'CONDITION':
      return <ConditionActionForm step={step} action={action} update={update} />
    case 'GOTO':
      return <GotoActionForm step={step} action={action} update={update} />
    case 'LAB':
      return <LabActionForm step={step} action={action} update={update} />
  }
}

const ActionCard = ({
  step,
  action,
  index,
  count
}: {
  step: LessonNode
  action: StepAction
  index: number
  count: number
}): React.JSX.Element => {
  const [open, setOpen] = useState(true)
  const rootPath = useFileSystemStore((s) => s.rootPath)
  const lesson = useLessonStore.getState
  const button = 'rounded p-1 text-gray-400 hover:bg-ide-hover hover:text-white disabled:opacity-30'

  return (
    <div className="rounded border border-ide-border bg-ide-panel">
      <div
        className="flex cursor-pointer items-center gap-2 px-3 py-2"
        onClick={() => setOpen(!open)}
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className="w-5 text-right text-[11px] tabular-nums text-ide-muted">{index + 1}</span>
        <ActionIcon kind={action.kind} />
        <select
          className="rounded border border-transparent bg-transparent py-0.5 text-[13px] font-semibold text-white outline-none hover:border-ide-border"
          value={action.kind}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => lesson().setActionKind(step.id, action.id, e.target.value as ActionKind)}
          title="Tipo da ação"
        >
          {ADDABLE.map((kind) => (
            <option key={kind} value={kind} className="bg-ide-panel">
              {ACTION_LABELS[kind]}
            </option>
          ))}
        </select>
        <span className="flex-1 truncate font-mono text-[11px] text-ide-muted">
          {describeAction(action, rootPath)}
        </span>
        <span className="flex" onClick={(e) => e.stopPropagation()}>
          <button
            className={button}
            disabled={index === 0}
            onClick={() => lesson().moveAction(step.id, action.id, 'up')}
            title="Mover para cima"
          >
            <ChevronUp size={14} />
          </button>
          <button
            className={button}
            disabled={index === count - 1}
            onClick={() => lesson().moveAction(step.id, action.id, 'down')}
            title="Mover para baixo"
          >
            <ChevronDown size={14} />
          </button>
          <button
            className={clsx(button, 'hover:text-red-400')}
            onClick={() => lesson().removeAction(step.id, action.id)}
            title="Remover ação"
          >
            <X size={14} />
          </button>
        </span>
      </div>
      {open && (
        <div className="border-t border-ide-border p-4">
          <ActionForm step={step} action={action} />
        </div>
      )}
    </div>
  )
}

const AddActionMenu = ({ stepId }: { stepId: string }): React.JSX.Element => {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-center gap-2 rounded border border-dashed border-ide-border py-2 text-[13px] text-gray-400 hover:border-ide-accent hover:text-white"
      >
        <Plus size={14} /> Adicionar ação
      </button>
      {open && (
        <div className="mt-2 grid grid-cols-4 gap-2">
          {ADDABLE.map((kind) => (
            <button
              key={kind}
              onClick={() => {
                useLessonStore.getState().addAction(stepId, kind)
                setOpen(false)
              }}
              className="flex items-center gap-2 rounded border border-ide-border bg-ide-panel px-2 py-2 text-left text-[12px] text-gray-300 hover:border-ide-accent hover:text-white"
            >
              <ActionIcon kind={kind} /> {ACTION_LABELS[kind]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const StepConfigEditor = ({ stepId }: { stepId: string }): React.JSX.Element => {
  const step = useLessonStore((s) => findNode(s.tree, stepId))
  const isRunning = usePlayerStore((s) => s.runningStepId === stepId)
  const busy = usePlayerStore((s) => s.runningStepId !== null)
  const lesson = useLessonStore.getState

  if (!step || step.type !== 'STEP' || !step.data) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-ide-muted">
        Este passo foi removido.
      </div>
    )
  }
  const { actions } = step.data

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl space-y-6 p-8">
        <div className="flex items-center gap-2">
          <input
            className="min-w-0 flex-1 border-b border-transparent bg-transparent pb-1 text-2xl font-light text-white outline-none hover:border-ide-border focus:border-ide-accent"
            value={step.title}
            onChange={(e) => lesson().updateNode(step.id, { title: e.target.value })}
            aria-label="Título do passo"
          />
          <button
            onClick={() => usePlayerStore.getState().runStep(step.id)}
            disabled={busy}
            className="flex items-center gap-2 rounded bg-green-700 px-4 py-1.5 text-sm text-white hover:bg-green-600 disabled:opacity-50"
            title="Executa este passo agora"
          >
            {isRunning ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            Executar
          </button>
          <button
            onClick={() => usePlayerStore.getState().goTo(step.id)}
            disabled={busy}
            className="rounded p-2 text-gray-400 hover:bg-ide-hover hover:text-white disabled:opacity-50"
            title="Ir até este passo (executa ou desfaz os anteriores)"
          >
            <StepForward size={16} />
          </button>
          <button
            onClick={() => deleteNode(step)}
            className="rounded p-2 text-gray-400 hover:bg-ide-hover hover:text-red-400"
            title="Excluir passo"
          >
            <Trash size={16} />
          </button>
        </div>

        <section className="space-y-3">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-ide-muted">
            Ações ({actions.length}) — executadas em ordem
          </h2>
          {actions.map((action, index) => (
            <ActionCard
              key={action.id}
              step={step}
              action={action}
              index={index}
              count={actions.length}
            />
          ))}
          <AddActionMenu stepId={step.id} />
        </section>

        <section className="grid grid-cols-2 gap-4">
          <Field
            title="Legenda (pública)"
            hint="Aparece para a turma: no palco, no OBS e na página dos alunos. Aceita Markdown."
          >
            <textarea
              className={clsx(input, 'h-28 w-full resize-y')}
              value={step.data.caption ?? ''}
              placeholder="O que a turma deve entender neste passo…"
              onChange={(e) => lesson().updateStepData(step.id, { caption: e.target.value })}
            />
          </Field>
          <Field
            title="Notas do apresentador (privadas)"
            hint="Só você vê: na aba Passos e na visão do apresentador."
          >
            <textarea
              className={clsx(input, 'h-28 w-full resize-y')}
              value={step.data.presenterNotes ?? ''}
              placeholder="O que explicar antes de executar este passo…"
              onChange={(e) => lesson().updateStepData(step.id, { presenterNotes: e.target.value })}
            />
          </Field>
        </section>
        {step.data.caption?.trim() && (
          <div className="rounded border border-ide-border bg-ide-panel px-4 py-3 text-[14px] text-gray-200">
            <div className="mb-1 text-[11px] uppercase tracking-wider text-ide-muted">
              Prévia da legenda
            </div>
            <Markdown source={step.data.caption} />
          </div>
        )}
      </div>
    </div>
  )
}

export default StepConfigEditor
