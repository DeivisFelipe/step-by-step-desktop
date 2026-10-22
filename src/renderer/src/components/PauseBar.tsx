import { FlaskConical, Play, Signpost, SkipForward } from 'lucide-react'
import { runLabCommand, usePauseStore } from '../engine/ExecutionEngine'
import { usePlayerStore } from '../store/usePlayerStore'
import { basename } from '../lib/paths'

/**
 * Floating bar over the editor while a step waits for the presenter:
 * the options of a menu, or the lab's ▶ and "continue".
 */
const PauseBar = (): React.JSX.Element | null => {
  const kind = usePauseStore((s) => s.kind)
  const choice = usePauseStore((s) => s.choice)
  const lab = usePauseStore((s) => s.lab)

  if (kind === 'choice' && choice) {
    return (
      <div className="absolute inset-x-0 top-3 z-30 flex justify-center px-4">
        <div className="max-w-full rounded-lg border border-fuchsia-500/60 bg-ide-panel/95 px-4 py-3 shadow-2xl backdrop-blur">
          <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-white">
            <Signpost size={15} className="text-fuchsia-400" />
            {choice.title || 'Escolha o caminho'}
          </div>
          <div className="flex flex-wrap gap-2">
            {choice.options.map((option, i) => (
              <button
                key={i}
                onClick={() => usePlayerStore.getState().choose(i)}
                className="flex items-center gap-2 rounded bg-ide-input px-3 py-1.5 text-[13px] text-white hover:bg-fuchsia-700"
              >
                <kbd className="rounded bg-black/40 px-1.5 text-[11px] text-gray-300">{i + 1}</kbd>
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (kind === 'lab' && lab) {
    return (
      <div className="absolute right-4 top-3 z-30 flex items-center gap-2 rounded-lg border border-lime-500/50 bg-ide-panel/95 px-3 py-2 shadow-2xl backdrop-blur">
        <FlaskConical size={15} className="text-lime-400" />
        <span className="text-[12px] text-gray-300">
          Laboratório · <span className="font-mono">{basename(lab.path)}</span>
        </span>
        <button
          onClick={() => runLabCommand()}
          title={`Salvar e rodar: ${lab.command} (Ctrl+Enter)`}
          className="flex items-center gap-1.5 rounded bg-green-700 px-3 py-1 text-[12px] text-white hover:bg-green-600"
        >
          <Play size={13} /> Rodar
        </button>
        <button
          onClick={() => usePlayerStore.getState().runNext()}
          title="Continuar a aula (F8)"
          className="flex items-center gap-1.5 rounded bg-ide-input px-3 py-1 text-[12px] text-white hover:bg-ide-border"
        >
          Continuar <SkipForward size={13} />
        </button>
      </div>
    )
  }

  return null
}

export default PauseBar
