import { useState } from 'react'
import { Check, Copy, Wifi, WifiOff } from 'lucide-react'
import { ChallengeView, Markdown, SlideView } from '../common/StageViews'
import { useConnection } from './connection'
import { useHighlighter } from './highlighter'
import { StaticCode } from './CodeContent'
import { TerminalContent } from './TerminalContent'
import { BUILTIN_PRESETS } from '../../shared/presentation'

const STYLE = { ...BUILTIN_PRESETS.Carbon, fontSize: 15, lineNumbers: true }

/** Read-only page for students following on a phone or laptop. */
const StudentPage = (): React.JSX.Element => {
  const stage = useConnection((s) => s.stage)
  const connected = useConnection((s) => s.connected)
  const clockOffset = useConnection((s) => s.clockOffset)
  const ready = useHighlighter('github-dark', stage?.code?.language ?? 'text')
  const [copied, setCopied] = useState(false)

  const copy = (): void => {
    if (!stage?.code) return
    navigator.clipboard.writeText(stage.code.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="min-h-full bg-[#0d1117] text-gray-200">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-white/10 bg-[#161b22]/95 px-4 py-3 backdrop-blur">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] text-gray-400">
            {stage?.lessonTitle}
            {stage?.flowTitle && ` · ${stage.flowTitle}`}
          </div>
          <div className="truncate font-semibold text-white">
            {stage && stage.stepNumber > 0
              ? `Passo ${stage.stepNumber}/${stage.stepTotal} · ${stage.stepTitle}`
              : 'Aguardando a aula começar…'}
          </div>
        </div>
        {connected ? (
          <Wifi size={18} className="text-green-400" />
        ) : (
          <WifiOff size={18} className="text-red-400" />
        )}
      </header>

      <main className="mx-auto max-w-4xl space-y-4 p-4">
        {stage?.caption?.trim() && (
          <div className="rounded-lg border border-sky-900 bg-sky-950/40 px-4 py-3 text-[15px]">
            <Markdown source={stage.caption} />
          </div>
        )}

        {stage?.view === 'slide' && stage.slide && (
          <div className="aspect-video overflow-hidden rounded-lg bg-[#1f2937]">
            <SlideView slide={stage.slide} fontSize={16} />
          </div>
        )}
        {stage?.view === 'challenge' && stage.challenge && (
          <div className="overflow-hidden rounded-lg bg-[#1f2937] py-6">
            <ChallengeView challenge={stage.challenge} fontSize={16} clockOffset={clockOffset} />
          </div>
        )}
        {stage?.view === 'preview' && stage.preview && (
          <p className="rounded-lg bg-[#161b22] px-4 py-3 text-[14px]">
            Página em exibição: <span className="font-mono text-sky-300">{stage.preview}</span>
          </p>
        )}

        {stage?.code && (
          <section className="overflow-hidden rounded-lg border border-white/10 bg-[#0d1117]">
            <div className="flex items-center justify-between border-b border-white/10 bg-[#161b22] px-3 py-2 text-[13px]">
              <span className="font-mono text-gray-300">{stage.code.path}</span>
              <button
                onClick={copy}
                className="flex items-center gap-1.5 rounded px-2 py-1 text-gray-300 hover:bg-white/10"
              >
                {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <div className="overflow-x-auto p-3 font-mono text-[13px] leading-relaxed">
              {ready ? (
                <StaticCode code={stage.code} style={STYLE} ready={ready} wrap />
              ) : (
                <pre>{stage.code.content}</pre>
              )}
            </div>
          </section>
        )}

        {stage?.terminalId !== null && stage?.terminalId !== undefined && (
          <section className="overflow-hidden rounded-lg border border-white/10">
            <div className="border-b border-white/10 bg-[#161b22] px-3 py-2 text-[13px] text-gray-300">
              {stage.terminalName || 'Terminal'}
            </div>
            <div className="h-64">
              <TerminalContent
                terminalId={stage.terminalId}
                fontSize={12}
                fontFamily="Consolas, monospace"
                background="#0d1117"
                foreground="#c9d1d9"
              />
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

export default StudentPage
