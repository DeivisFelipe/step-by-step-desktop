import { useEffect, useState } from 'react'
import { BookOpen, Play, RotateCcw } from 'lucide-react'
import type { ExampleInfo } from '../../../../shared/ipc'
import { openWorkspace } from '../../lib/workspace'
import { reportError, useIDEStore } from '../../store/useIDEStore'

/** Example lessons shipped with the app: a click copies one to Documents and opens it. */
const ExampleLessons = (): React.JSX.Element | null => {
  const [examples, setExamples] = useState<ExampleInfo[]>([])

  useEffect(() => {
    window.api.listExamples().then(setExamples)
  }, [])

  if (examples.length === 0) return null

  const open = async (example: ExampleInfo, fresh: boolean): Promise<void> => {
    try {
      const folder = await window.api.installExample(example.id, fresh)
      await openWorkspace(folder)
      useIDEStore.getState().setActiveActivity('STEPS')
      window.api.listExamples().then(setExamples)
    } catch (e) {
      reportError(e, 'Não foi possível abrir o exemplo')
    }
  }

  return (
    <section className="w-full">
      <h2 className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wider text-ide-muted">
        <BookOpen size={13} /> Aulas de exemplo
      </h2>
      <p className="mb-3 text-[12px] text-ide-muted">
        Prontas para apresentar ou para usar de modelo. Cada uma abre como uma cópia na pasta
        Documentos/Step-by-Step Code/Exemplos.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {examples.map((example) => (
          <div
            key={example.id}
            className="group flex flex-col rounded-lg border border-ide-border bg-ide-panel p-3 hover:border-ide-accent"
          >
            <button
              className="flex flex-1 flex-col text-left"
              onClick={() => open(example, false)}
              title={example.copy ? `Abrir a cópia em ${example.copy}` : 'Copiar e abrir'}
            >
              <span className="text-[14px] font-medium text-white">{example.title}</span>
              <span className="mt-1 flex-1 text-[12px] leading-snug text-gray-400">
                {example.description}
              </span>
              <span className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="rounded bg-ide-input px-1.5 py-0.5 text-gray-300">
                  {example.steps} passos
                </span>
                <span
                  className={
                    example.requires
                      ? 'rounded bg-amber-900/40 px-1.5 py-0.5 text-amber-300'
                      : 'rounded bg-green-900/40 px-1.5 py-0.5 text-green-300'
                  }
                >
                  {example.requires ? `requer ${example.requires}` : 'não precisa instalar nada'}
                </span>
              </span>
            </button>
            <div className="mt-3 flex gap-2 text-[12px]">
              <button
                onClick={() => open(example, false)}
                className="flex items-center gap-1 rounded bg-ide-accent px-2 py-1 text-white hover:bg-sky-600"
              >
                <Play size={12} /> {example.copy ? 'Continuar' : 'Abrir'}
              </button>
              {example.copy && (
                <button
                  onClick={() => open(example, true)}
                  className="flex items-center gap-1 rounded bg-ide-input px-2 py-1 text-gray-300 hover:bg-ide-border"
                  title="Cria outra cópia, do começo"
                >
                  <RotateCcw size={12} /> Nova cópia
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export default ExampleLessons
