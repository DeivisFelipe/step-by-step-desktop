import clsx from 'clsx'
import Editor from '@monaco-editor/react'
import { FileCode, Loader2, Play, Terminal, Trash } from 'lucide-react'
import { useLessonStore } from '../../store/useLessonStore'
import { useFileSystemStore } from '../../store/useFileSystemStore'
import { usePlayerStore } from '../../store/usePlayerStore'
import { FileAction, FileOperation, LessonNode, TerminalAction } from '../../types/schema'
import { findNode, findPlaceholders } from '../../lib/tree'
import { languageFromPath } from '../../lib/paths'
import { describeTarget } from '../../engine/ExecutionEngine'
import { deleteNode } from '../../lib/lessonActions'
import { EDITOR_OPTIONS } from '../../lib/monaco'

const OPERATIONS: { value: FileOperation; label: string; hint: string }[] = [
  { value: 'CREATE', label: 'Criar arquivo', hint: 'cria o arquivo com o conteúdo abaixo' },
  { value: 'APPEND', label: 'Acrescentar ao final', hint: 'acrescenta o conteúdo ao final de' },
  { value: 'PREPEND', label: 'Inserir no início', hint: 'insere o conteúdo no início de' },
  { value: 'REPLACE_TOKEN', label: 'Substituir texto', hint: 'substitui um trecho de' },
  {
    value: 'CURSOR_POSITION',
    label: 'Inserir no cursor',
    hint: 'insere o conteúdo na posição do cursor em'
  },
  { value: 'OVERWRITE', label: 'Sobrescrever arquivo', hint: 'substitui todo o conteúdo de' }
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

const input =
  'rounded border border-ide-border bg-ide-input px-2 py-1.5 text-[13px] text-white outline-none focus:border-ide-accent'
const label = 'mb-1 block text-[12px] font-semibold text-gray-400'

const Field = ({
  title,
  hint,
  children,
  className
}: {
  title: string
  hint?: string
  children: React.ReactNode
  className?: string
}): React.JSX.Element => (
  <div className={className}>
    <label className={label}>{title}</label>
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
    <div className="rounded border border-ide-border bg-ide-panel p-3">
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

const FileActionForm = ({
  step,
  action
}: {
  step: LessonNode
  action: FileAction
}): React.JSX.Element => {
  const update = (partial: Partial<FileAction>): void =>
    useLessonStore.getState().updateAction(step.id, partial)
  const updateConfig = (partial: Partial<FileAction['config']>): void =>
    update({ config: { ...action.config, ...partial } })

  const usesPath = action.operation === 'CREATE' || action.targetMode === 'SPECIFIC_PATH'
  const language =
    action.config.language || (usesPath ? languageFromPath(action.targetPath) : 'plaintext')

  return (
    <div className="space-y-5">
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
        {action.operation !== 'CREATE' && (
          <Field title="Arquivo alvo">
            <select
              className={clsx(input, 'w-full')}
              value={action.targetMode}
              onChange={(e) => update({ targetMode: e.target.value as FileAction['targetMode'] })}
            >
              <option value="SPECIFIC_PATH">Caminho específico</option>
              <option value="ACTIVE_FILE">Arquivo aberto no editor</option>
            </select>
          </Field>
        )}
      </div>

      {usesPath && (
        <Field
          title="Caminho do arquivo"
          hint="Relativo à pasta aberta. Pastas que não existem são criadas."
        >
          <input
            className={clsx(input, 'w-full font-mono')}
            value={action.targetPath ?? ''}
            placeholder="src/index.js"
            onChange={(e) => update({ targetPath: e.target.value })}
            spellCheck={false}
          />
        </Field>
      )}

      {action.operation === 'REPLACE_TOKEN' && (
        <Field
          title="Texto a substituir"
          hint="A primeira ocorrência deste texto no arquivo é substituída pelo conteúdo."
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

      <div className="space-y-2">
        <Check
          checked={action.config.typingAnimation}
          onChange={(typingAnimation) => updateConfig({ typingAnimation })}
        >
          Digitação animada
        </Check>
        {action.config.typingAnimation && (
          <SpeedSlider
            value={action.config.typingSpeedMs ?? 30}
            onChange={(typingSpeedMs) => updateConfig({ typingSpeedMs })}
          />
        )}
      </div>

      <Field title="Conteúdo">
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
        <div className="h-72 overflow-hidden rounded border border-ide-border">
          <Editor
            height="100%"
            theme="vs-dark"
            path={`ssc-step://${step.id}`}
            language={language}
            value={action.content}
            onChange={(value) => update({ content: value ?? '' })}
            options={{ ...EDITOR_OPTIONS, fontSize: 13, lineNumbersMinChars: 3 }}
          />
        </div>
        <p className="mt-1 text-[11px] text-ide-muted">
          Use <code className="text-gray-300">[[Nome:valor]]</code> para criar variáveis que podem
          ser ajustadas antes de executar.
        </p>
      </Field>

      <Placeholders text={action.content} onChange={(content) => update({ content })} />
    </div>
  )
}

const TerminalActionForm = ({
  step,
  action
}: {
  step: LessonNode
  action: TerminalAction
}): React.JSX.Element => {
  const update = (partial: Partial<TerminalAction>): void =>
    useLessonStore.getState().updateAction(step.id, partial)

  return (
    <div className="space-y-5">
      <Field title="Comando" hint="Cada linha é enviada como um comando separado.">
        <textarea
          className={clsx(input, 'h-24 w-full resize-y font-mono')}
          value={action.command}
          placeholder="npm install"
          onChange={(e) => update({ command: e.target.value })}
          spellCheck={false}
        />
      </Field>
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
}

function summary(step: LessonNode, root: string | null): string {
  const action = step.data!.action
  if (action.kind === 'TERMINAL') {
    return action.executeImmediately
      ? 'Ao executar, o comando é digitado e executado no terminal.'
      : 'Ao executar, o comando é digitado no terminal sem pressionar Enter.'
  }
  const op = OPERATIONS.find((o) => o.value === action.operation)!
  const target = describeTarget(action, root)
  const animation = action.config.typingAnimation ? ' com digitação animada' : ''
  if (action.operation === 'CREATE') return `Ao executar, ${op.hint} em ${target}${animation}.`
  return `Ao executar, ${op.hint} ${target}${animation}.`
}

const StepConfigEditor = ({ stepId }: { stepId: string }): React.JSX.Element => {
  const step = useLessonStore((s) => findNode(s.tree, stepId))
  const rootPath = useFileSystemStore((s) => s.rootPath)
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
  const { action } = step.data

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl space-y-6 p-8">
        <div className="flex items-center gap-3">
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
            onClick={() => deleteNode(step)}
            className="rounded p-2 text-gray-400 hover:bg-ide-hover hover:text-red-400"
            title="Excluir passo"
          >
            <Trash size={16} />
          </button>
        </div>

        <div className="flex gap-2">
          {(
            [
              ['FILE', 'Código em arquivo', FileCode],
              ['TERMINAL', 'Comando no terminal', Terminal]
            ] as const
          ).map(([kind, text, Icon]) => (
            <button
              key={kind}
              onClick={() => lesson().setActionKind(step.id, kind)}
              className={clsx(
                'flex items-center gap-2 rounded border px-3 py-1.5 text-[13px]',
                action.kind === kind
                  ? 'border-ide-accent bg-ide-select/40 text-white'
                  : 'border-ide-border text-gray-400 hover:bg-ide-hover'
              )}
            >
              <Icon size={15} /> {text}
            </button>
          ))}
        </div>

        <p className="rounded bg-ide-panel px-3 py-2 text-[13px] text-gray-300">
          {summary(step, rootPath)}
        </p>

        {action.kind === 'FILE' ? (
          <FileActionForm step={step} action={action} />
        ) : (
          <TerminalActionForm step={step} action={action} />
        )}

        <Field
          title="Notas do apresentador"
          hint="Aparecem na aba Passos quando este é o próximo passo."
        >
          <textarea
            className={clsx(input, 'h-24 w-full resize-y')}
            value={step.data.presenterNotes ?? ''}
            placeholder="O que explicar antes de executar este passo…"
            onChange={(e) => lesson().updateStepData(step.id, { presenterNotes: e.target.value })}
          />
        </Field>
      </div>
    </div>
  )
}

export default StepConfigEditor
