import { useEffect, useState } from 'react'
import clsx from 'clsx'
import {
  CheckCircle2,
  Loader2,
  Play,
  Signpost,
  SkipBack,
  SkipForward,
  FastForward,
  StickyNote
} from 'lucide-react'
import { Markdown } from '../common/StageViews'
import { formatClock } from '../common/format'
import { PresenterStep } from '../../shared/presentation'
import { sendCommand, useConnection } from './connection'

function useNow(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  return now
}

const StepCard = ({
  label,
  step,
  highlight
}: {
  label: string
  step: PresenterStep | undefined
  highlight?: boolean
}): React.JSX.Element => (
  <div
    className={clsx(
      'rounded-xl border p-4',
      highlight ? 'border-sky-700 bg-sky-950/40' : 'border-white/10 bg-white/5'
    )}
  >
    <div className="mb-1 text-[12px] uppercase tracking-wider text-gray-400">{label}</div>
    {step ? (
      <>
        <div className="text-[20px] font-semibold text-white">
          {step.number}. {step.title}
        </div>
        {step.flowTitle && <div className="text-[13px] text-gray-400">{step.flowTitle}</div>}
        {step.notes.trim() && (
          <div className="mt-3 flex gap-2 whitespace-pre-wrap text-[17px] leading-relaxed text-yellow-100">
            <StickyNote size={18} className="mt-1 flex-none text-yellow-400" />
            <span>{step.notes}</span>
          </div>
        )}
        {step.caption.trim() && (
          <div className="mt-3 rounded-lg bg-black/30 px-3 py-2 text-[14px] text-gray-300">
            <div className="mb-1 text-[11px] uppercase tracking-wider text-gray-500">Legenda</div>
            <Markdown source={step.caption} />
          </div>
        )}
      </>
    ) : (
      <div className="text-gray-500">—</div>
    )}
  </div>
)

/** Private view: notes, timers and remote buttons (needs ?token=). */
const PresenterPage = (): React.JSX.Element => {
  const presenter = useConnection((s) => s.presenter)
  const authorized = useConnection((s) => s.authorized)
  const connected = useConnection((s) => s.connected)
  const clockOffset = useConnection((s) => s.clockOffset)
  const now = useNow() + clockOffset

  if (connected && !authorized) {
    return (
      <div className="flex h-full items-center justify-center bg-[#111827] p-8 text-center text-gray-300">
        Link sem a chave de acesso. Abra a visão do apresentador pelo app (aba Apresentação).
      </div>
    )
  }

  const steps = presenter?.steps ?? []
  const current = steps.find((s) => s.id === presenter?.currentId)
  const next = steps.find((s) => s.id === presenter?.nextId)
  const running = !!presenter?.runningId
  const waiting = presenter?.waiting ?? null
  const executed = steps.filter((s) => s.executed).length

  const button =
    'flex flex-1 items-center justify-center gap-2 rounded-xl py-4 text-[18px] font-semibold disabled:opacity-40 active:scale-[0.98] transition'

  return (
    <div className="min-h-full bg-[#111827] text-gray-200">
      <div className="mx-auto grid max-w-6xl gap-4 p-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div className="flex gap-3">
            <button
              className={clsx(button, 'bg-white/10 text-white hover:bg-white/15')}
              disabled={running || executed === 0}
              onClick={() => sendCommand({ command: 'prev' })}
            >
              <SkipBack size={20} /> Voltar
            </button>
            {waiting && waiting.kind !== 'choice' ? (
              <button
                className={clsx(button, 'bg-sky-600 text-white hover:bg-sky-500')}
                onClick={() => sendCommand({ command: 'next' })}
              >
                {waiting.kind === 'lab' ? 'Continuar' : 'Rodar comando'} <SkipForward size={20} />
              </button>
            ) : running ? (
              <button
                className={clsx(button, 'bg-amber-600 text-white hover:bg-amber-500')}
                onClick={() => sendCommand({ command: 'skip' })}
              >
                <FastForward size={20} /> Pular animação
              </button>
            ) : (
              <button
                className={clsx(button, 'bg-sky-600 text-white hover:bg-sky-500')}
                disabled={!next}
                onClick={() => sendCommand({ command: 'next' })}
              >
                Avançar <SkipForward size={20} />
              </button>
            )}
          </div>
          {waiting?.kind === 'choice' && (
            <div className="rounded-xl border border-fuchsia-500/50 bg-fuchsia-950/30 p-4">
              <div className="mb-3 flex items-center gap-2 text-[18px] font-semibold text-white">
                <Signpost size={20} className="text-fuchsia-400" />
                {waiting.title || 'Escolha o caminho'}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {waiting.options.map((option, i) => (
                  <button
                    key={i}
                    className="flex items-center gap-3 rounded-lg bg-white/10 px-4 py-3 text-left text-[17px] text-white hover:bg-fuchsia-700"
                    onClick={() => sendCommand({ command: 'choose', value: i })}
                  >
                    <span className="rounded bg-black/40 px-2 font-mono text-[14px]">{i + 1}</span>
                    {option}
                  </button>
                ))}
              </div>
            </div>
          )}
          {waiting?.kind === 'lab' && (
            <button
              className={clsx(button, 'w-full bg-green-700 text-white hover:bg-green-600')}
              onClick={() => sendCommand({ command: 'run', value: '' })}
            >
              <Play size={20} /> Rodar o código do laboratório
            </button>
          )}
          <StepCard label={running ? 'Executando' : 'Passo atual'} step={current} />
          <StepCard label="Próximo passo" step={next} highlight />
        </div>

        <aside className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-white/5 p-3 text-center">
              <div className="text-[11px] uppercase tracking-wider text-gray-400">Aula</div>
              <div className="font-mono text-[26px] tabular-nums text-white">
                {presenter?.sessionStartedAt
                  ? formatClock(now - presenter.sessionStartedAt)
                  : '00:00'}
              </div>
            </div>
            <div className="rounded-xl bg-white/5 p-3 text-center">
              <div className="text-[11px] uppercase tracking-wider text-gray-400">Passo</div>
              <div className="font-mono text-[26px] tabular-nums text-white">
                {presenter?.stepStartedAt ? formatClock(now - presenter.stepStartedAt) : '00:00'}
              </div>
            </div>
          </div>
          <div>
            <div className="mb-1 flex justify-between text-[12px] text-gray-400">
              <span>Progresso</span>
              <span className="tabular-nums">
                {executed}/{steps.length}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-green-500 transition-all"
                style={{ width: steps.length ? `${(executed / steps.length) * 100}%` : 0 }}
              />
            </div>
          </div>
          <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-white/10">
            {steps.map((step) => (
              <button
                key={step.id}
                className={clsx(
                  'flex w-full items-center gap-2 border-b border-white/5 px-3 py-2 text-left text-[14px] hover:bg-white/5',
                  step.id === presenter?.nextId && 'bg-sky-950/50'
                )}
                onClick={() => {
                  if (confirm(`Ir até o passo ${step.number}?`)) {
                    sendCommand({ command: 'goto', stepId: step.id })
                  }
                }}
              >
                <span className="w-6 text-right text-[12px] tabular-nums text-gray-500">
                  {step.number}
                </span>
                <span className={clsx('flex-1 truncate', step.executed && 'text-gray-500')}>
                  {step.title}
                </span>
                {step.id === presenter?.runningId ? (
                  <Loader2 size={14} className="animate-spin text-sky-400" />
                ) : (
                  step.executed && <CheckCircle2 size={14} className="text-green-500" />
                )}
              </button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  )
}

export default PresenterPage
