import { FolderOpen, ListChecks } from 'lucide-react'
import logo from '../../assets/logo.png'
import { useFileSystemStore } from '../../store/useFileSystemStore'
import { useIDEStore } from '../../store/useIDEStore'
import { basename } from '../../lib/paths'
import { chooseWorkspace, getRecentFolders, openWorkspace } from '../../lib/workspace'

const SHORTCUTS: [string, string][] = [
  ['F8', 'Executar o próximo passo'],
  ['Shift+F8', 'Voltar o último passo'],
  ['Esc', 'Pular a animação de digitação'],
  ['Ctrl+S', 'Salvar arquivo'],
  ['Ctrl+O', 'Abrir pasta'],
  ['Ctrl+B', 'Mostrar/ocultar barra lateral'],
  ['Ctrl+J', 'Mostrar/ocultar terminal'],
  ['Ctrl+Roda do mouse', 'Zoom no editor']
]

const Welcome = (): React.JSX.Element => {
  const rootPath = useFileSystemStore((s) => s.rootPath)
  const recent = getRecentFolders().filter((p) => p !== rootPath)

  return (
    <div className="flex h-full items-center justify-center overflow-y-auto p-8">
      <div className="flex w-full max-w-3xl flex-col items-center gap-10 md:flex-row md:items-start">
        <div className="flex flex-col items-center text-center md:w-1/2">
          <img src={logo} alt="" className="mb-4 h-48 w-48 opacity-90" draggable={false} />
          <h1 className="text-3xl font-light tracking-wide text-white">Step-by-Step Code</h1>
          <p className="mt-2 text-sm text-ide-muted">
            Prepare a aula antes e apresente o código passo a passo.
          </p>
          <div className="mt-6 flex flex-col gap-2 text-sm">
            {!rootPath ? (
              <button
                onClick={chooseWorkspace}
                className="flex items-center gap-2 rounded bg-ide-accent px-4 py-2 text-white hover:bg-sky-600"
              >
                <FolderOpen size={16} /> Abrir pasta do projeto
              </button>
            ) : (
              <button
                onClick={() => useIDEStore.getState().setActiveActivity('STEPS')}
                className="flex items-center gap-2 rounded bg-ide-accent px-4 py-2 text-white hover:bg-sky-600"
              >
                <ListChecks size={16} /> Ver passos da aula
              </button>
            )}
          </div>
          {recent.length > 0 && (
            <div className="mt-6 w-full text-left text-sm">
              <div className="mb-1 text-xs uppercase tracking-wider text-ide-muted">Recentes</div>
              {recent.map((path) => (
                <button
                  key={path}
                  onClick={() => openWorkspace(path)}
                  className="flex w-full items-baseline gap-2 truncate rounded px-1 py-0.5 text-left hover:bg-ide-hover"
                  title={path}
                >
                  <span className="text-sky-400">{basename(path)}</span>
                  <span className="truncate text-xs text-ide-muted">{path}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="w-full text-sm md:w-1/2">
          <h2 className="mb-2 text-xs uppercase tracking-wider text-ide-muted">Como funciona</h2>
          <ol className="mb-6 list-decimal space-y-1 pl-5 text-gray-300">
            <li>Abra a pasta do projeto que será usado na aula.</li>
            <li>Na aba Passos, crie um fluxo e adicione passos (código ou comandos).</li>
            <li>Durante a aula, aperte F8 para digitar cada passo na frente da turma.</li>
          </ol>
          <h2 className="mb-2 text-xs uppercase tracking-wider text-ide-muted">Atalhos</h2>
          <table className="w-full">
            <tbody>
              {SHORTCUTS.map(([keys, label]) => (
                <tr key={keys}>
                  <td className="py-0.5 pr-4 text-gray-300">{label}</td>
                  <td className="py-0.5 text-right">
                    <kbd className="rounded border border-ide-border bg-ide-tab px-1.5 py-0.5 font-mono text-xs text-gray-200">
                      {keys}
                    </kbd>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default Welcome
