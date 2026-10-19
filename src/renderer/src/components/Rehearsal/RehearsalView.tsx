import clsx from 'clsx'
import { AlertCircle, AlertTriangle, CheckCircle2, FlaskConical, Info, Loader2 } from 'lucide-react'
import { useRehearsalStore, RehearsalIssue } from '../../engine/Rehearsal'
import { useLessonStore } from '../../store/useLessonStore'
import { findNode } from '../../lib/tree'
import { openNode } from '../../lib/lessonActions'

const LEVEL = {
  error: { icon: AlertCircle, color: 'text-red-400', label: 'erro' },
  warning: { icon: AlertTriangle, color: 'text-yellow-400', label: 'aviso' },
  info: { icon: Info, color: 'text-sky-400', label: 'info' }
} as const

const IssueRow = ({ issue }: { issue: RehearsalIssue }): React.JSX.Element => {
  const { icon: Icon, color } = LEVEL[issue.level]
  return (
    <button
      className="flex w-full items-start gap-3 rounded px-3 py-2 text-left hover:bg-ide-hover"
      onClick={() => {
        const node = findNode(useLessonStore.getState().tree, issue.stepId)
        if (node) openNode(node)
      }}
    >
      <Icon size={16} className={clsx('mt-0.5 flex-none', color)} />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] text-white">
          Passo {issue.stepNumber} · {issue.stepTitle}
          {issue.actionIndex !== null && (
            <span className="text-ide-muted"> · ação {issue.actionIndex + 1}</span>
          )}
        </div>
        <div className="whitespace-pre-wrap text-[12px] text-gray-400">{issue.message}</div>
      </div>
    </button>
  )
}

const RehearsalView = (): React.JSX.Element => {
  const { running, progress, runCommands, report, setRunCommands, run } = useRehearsalStore()
  const errors = report?.issues.filter((i) => i.level === 'error').length ?? 0
  const warnings = report?.issues.filter((i) => i.level === 'warning').length ?? 0
  const visible = report?.issues ?? []

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-6 p-8">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-light text-white">
            <FlaskConical size={24} className="text-lime-300" /> Ensaio da aula
          </h1>
          <p className="mt-2 text-[13px] text-gray-400">
            Executa todos os passos sem animação numa cópia do projeto em memória e lista o que
            daria errado durante a aula: arquivos que não existem, textos a substituir que não foram
            encontrados, linhas fora do arquivo, imagens faltando… Nada é alterado na sua pasta.
          </p>
        </div>

        <div className="space-y-3 rounded border border-ide-border bg-ide-panel p-4">
          <label className="flex cursor-pointer items-start gap-2 text-[13px] text-gray-300">
            <input
              type="checkbox"
              className="mt-1 accent-sky-500"
              checked={runCommands}
              onChange={(e) => setRunCommands(e.target.checked)}
            />
            <span>
              Executar também os comandos de terminal numa pasta temporária
              <span className="block text-[12px] text-ide-muted">
                Os comandos rodam de verdade (sem node_modules e .git copiados). Comandos que não
                terminam, como servidores, precisam de uma ação “Esperar o terminal” logo depois.
              </span>
            </span>
          </label>
          <button
            onClick={run}
            disabled={running}
            className="flex items-center gap-2 rounded bg-ide-accent px-4 py-1.5 text-[13px] text-white hover:bg-sky-600 disabled:opacity-60"
          >
            {running ? <Loader2 size={14} className="animate-spin" /> : <FlaskConical size={14} />}
            {running ? 'Ensaiando…' : 'Ensaiar a aula'}
          </button>
          {running && <p className="text-[12px] text-gray-400">{progress}</p>}
        </div>

        {report && !running && (
          <div className="space-y-3">
            <div
              className={clsx(
                'flex items-center gap-3 rounded px-4 py-3 text-[14px]',
                errors > 0
                  ? 'bg-red-950/50 text-red-200'
                  : warnings > 0
                    ? 'bg-yellow-950/40 text-yellow-100'
                    : 'bg-green-950/50 text-green-200'
              )}
            >
              {errors === 0 && warnings === 0 ? (
                <CheckCircle2 size={18} />
              ) : (
                <AlertTriangle size={18} />
              )}
              <span>
                {report.steps} passos verificados em {(report.durationMs / 1000).toFixed(1)} s
                {report.commandsRun > 0 && ` · ${report.commandsRun} comandos executados`} —{' '}
                {errors === 0 && warnings === 0
                  ? 'tudo certo!'
                  : `${errors} erro(s), ${warnings} aviso(s)`}
              </span>
            </div>
            {report.usedSnapshot && (
              <p className="text-[12px] text-ide-muted">
                A aula está em andamento: o ensaio partiu do ponto de partida salvo, não do estado
                atual dos arquivos.
              </p>
            )}
            <div className="divide-y divide-ide-border rounded border border-ide-border">
              {visible.map((issue, i) => (
                <IssueRow key={i} issue={issue} />
              ))}
              {visible.length === 0 && (
                <p className="px-3 py-2 text-[13px] text-ide-muted">Nenhum problema encontrado.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default RehearsalView
