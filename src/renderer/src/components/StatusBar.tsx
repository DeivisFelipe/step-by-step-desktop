import { AlertCircle, Check, FolderOpen, Loader2, SkipForward, TerminalSquare } from 'lucide-react'
import { useFileSystemStore } from '../store/useFileSystemStore'
import { useIDEStore } from '../store/useIDEStore'
import { useLessonStore } from '../store/useLessonStore'
import { usePlayerStore } from '../store/usePlayerStore'
import { findNode, flattenSteps } from '../lib/tree'
import { basename } from '../lib/paths'
import { chooseWorkspace } from '../lib/workspace'

const item = 'flex h-full items-center gap-1 px-2 hover:bg-white/10'

const StatusBar = (): React.JSX.Element => {
  const rootPath = useFileSystemStore((s) => s.rootPath)
  const saveState = useLessonStore((s) => s.saveState)
  const workspace = useLessonStore((s) => s.workspace)
  const tree = useLessonStore((s) => s.tree)
  const history = usePlayerStore((s) => s.history)
  const runningStepId = usePlayerStore((s) => s.runningStepId)
  const terminalVisible = useIDEStore((s) => s.terminalVisible)

  const total = flattenSteps(tree).length
  const running = runningStepId ? findNode(tree, runningStepId) : null

  return (
    <div className="flex h-6 flex-none items-center bg-ide-accent text-[12px] text-white">
      <button className={item} onClick={chooseWorkspace} title={rootPath ?? 'Abrir pasta'}>
        <FolderOpen size={13} />
        {rootPath ? basename(rootPath) : 'Nenhuma pasta aberta'}
      </button>
      {workspace && (
        <span className="flex items-center gap-1 px-2 opacity-90">
          {saveState === 'saving' ? (
            <>
              <Loader2 size={12} className="animate-spin" /> Salvando aula…
            </>
          ) : saveState === 'error' ? (
            <>
              <AlertCircle size={12} /> Erro ao salvar a aula
            </>
          ) : (
            <>
              <Check size={12} /> Aula salva
            </>
          )}
        </span>
      )}

      <span className="flex-1" />

      {running && (
        <button
          className={item}
          onClick={() => usePlayerStore.getState().skip()}
          title="Pular animação"
        >
          <Loader2 size={12} className="animate-spin" />
          Executando “{running.title}” — Esc para pular
        </button>
      )}
      <button
        className={item}
        onClick={() => usePlayerStore.getState().runNext()}
        title="Executar o próximo passo (F8)"
      >
        <SkipForward size={13} /> Passo {history.length}/{total}
      </button>
      <button
        className={item}
        onClick={() => useIDEStore.getState().setTerminalVisible(!terminalVisible)}
        title="Mostrar/ocultar terminal (Ctrl+J)"
      >
        <TerminalSquare size={13} />
      </button>
    </div>
  )
}

export default StatusBar
