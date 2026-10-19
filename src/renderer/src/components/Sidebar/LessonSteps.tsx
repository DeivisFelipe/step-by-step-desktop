import clsx from 'clsx'
import { FolderPlus, Plus, RotateCcw, SkipBack, SkipForward, StickyNote } from 'lucide-react'
import { useLessonStore } from '../../store/useLessonStore'
import { useIDEStore } from '../../store/useIDEStore'
import { getNextStep, usePlayerStore } from '../../store/usePlayerStore'
import { flattenSteps } from '../../lib/tree'
import { chooseWorkspace } from '../../lib/workspace'
import { SidebarHeader } from './FileExplorerHeader'
import StepTree from './StepTree'

const PlayerControls = (): React.JSX.Element => {
  const tree = useLessonStore((s) => s.tree)
  const history = usePlayerStore((s) => s.history)
  const running = usePlayerStore((s) => s.runningStepId !== null)
  const total = flattenSteps(tree).length
  const next = getNextStep(tree, history)

  const button =
    'flex items-center justify-center gap-1.5 rounded px-2 py-1 text-[12px] disabled:opacity-40'

  return (
    <div className="flex-none space-y-2 border-b border-ide-border px-3 pb-3">
      <div className="flex items-center gap-1">
        <button
          className={clsx(button, 'hover:bg-ide-border')}
          title="Resetar a aula (desfaz todos os passos)"
          disabled={running || history.length === 0}
          onClick={() => usePlayerStore.getState().resetAll()}
        >
          <RotateCcw size={14} />
        </button>
        <button
          className={clsx(button, 'flex-1 bg-ide-input hover:bg-ide-border')}
          title="Voltar um passo (Shift+F8)"
          disabled={running || history.length === 0}
          onClick={() => usePlayerStore.getState().undoLast()}
        >
          <SkipBack size={14} /> Voltar
        </button>
        <button
          className={clsx(button, 'flex-1 bg-ide-accent text-white hover:bg-sky-600')}
          title="Executar o próximo passo (F8)"
          disabled={running || !next}
          onClick={() => usePlayerStore.getState().runNext()}
        >
          Avançar <SkipForward size={14} />
        </button>
      </div>
      <div className="flex items-center gap-2 text-[11px] text-ide-muted">
        <div className="h-1 flex-1 overflow-hidden rounded bg-ide-input">
          <div
            className="h-full bg-green-500 transition-all"
            style={{ width: total ? `${(history.length / total) * 100}%` : 0 }}
          />
        </div>
        <span className="tabular-nums">
          {history.length}/{total}
        </span>
      </div>
    </div>
  )
}

const NextStepCard = (): React.JSX.Element | null => {
  const tree = useLessonStore((s) => s.tree)
  const history = usePlayerStore((s) => s.history)
  const next = getNextStep(tree, history)
  if (!next) return null
  const notes = next.data?.presenterNotes?.trim()

  return (
    <div className="max-h-48 flex-none overflow-y-auto border-t border-ide-border bg-[#1f1f20] px-4 py-3 text-[12px]">
      <div className="mb-1 text-[11px] uppercase tracking-wider text-ide-muted">Próximo passo</div>
      <div className="font-medium text-white">{next.title}</div>
      {notes && (
        <div className="mt-2 flex gap-2 whitespace-pre-wrap text-gray-400">
          <StickyNote size={13} className="mt-0.5 flex-none text-yellow-500" />
          <span>{notes}</span>
        </div>
      )}
    </div>
  )
}

const LessonSteps = (): React.JSX.Element => {
  const workspace = useLessonStore((s) => s.workspace)
  const hasNodes = useLessonStore((s) => s.tree.length > 0)

  const add = (type: 'FLOW' | 'STEP'): void => {
    const lesson = useLessonStore.getState()
    const id = lesson.addNode(type, lesson.selectedNodeId)
    useIDEStore.getState().openNodeTab(id, type)
  }

  return (
    <div className="flex h-full flex-col">
      <SidebarHeader
        title="Passos da aula"
        actions={[
          { icon: FolderPlus, title: 'Novo fluxo', onClick: () => add('FLOW') },
          { icon: Plus, title: 'Novo passo', onClick: () => add('STEP') }
        ]}
      />
      <PlayerControls />

      {!workspace && (
        <div className="m-3 rounded border border-yellow-700/60 bg-yellow-900/20 p-2 text-[12px] text-yellow-200">
          A aula só é salva quando há uma pasta aberta.{' '}
          <button className="underline hover:text-white" onClick={chooseWorkspace}>
            Abrir pasta
          </button>
        </div>
      )}

      <div
        className="flex-1 overflow-y-auto py-1"
        onClick={() => useLessonStore.getState().selectNode(null)}
      >
        <StepTree />
        {!hasNodes && (
          <p className="px-5 py-2 text-[13px] text-ide-muted">
            Nenhum passo ainda. Use os botões acima para criar um fluxo e seus passos.
          </p>
        )}
      </div>

      <NextStepCard />
    </div>
  )
}

export default LessonSteps
