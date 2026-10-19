import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { GitBranch, Loader2 } from 'lucide-react'
import { GitCommit } from '../../../../shared/ipc'
import { useFileSystemStore } from '../../store/useFileSystemStore'
import { reportError, useIDEStore } from '../../store/useIDEStore'
import { useLessonStore } from '../../store/useLessonStore'
import { stepFromCommit } from '../../lib/exporters'
import { newId } from '../../lib/tree'
import { LessonNode } from '../../types/schema'

const GitImportView = (): React.JSX.Element => {
  const rootPath = useFileSystemStore((s) => s.rootPath)
  const [commits, setCommits] = useState<GitCommit[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [morph, setMorph] = useState(false)
  const [flowTitle, setFlowTitle] = useState('Importado do git')
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    if (!rootPath) return
    let cancelled = false
    window.api
      .gitLog(rootPath)
      .then((list) => !cancelled && setCommits(list))
      .catch((e: Error) => {
        if (!cancelled)
          setError(e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))
      })
    return () => {
      cancelled = true
    }
  }, [rootPath])

  if (!rootPath) {
    return <p className="p-8 text-sm text-ide-muted">Abra a pasta de um repositório git.</p>
  }

  const toggle = (hash: string): void => {
    const next = new Set(selected)
    if (next.has(hash)) next.delete(hash)
    else next.add(hash)
    setSelected(next)
  }

  const selectFrom = (index: number): void => {
    setSelected(new Set(commits!.slice(index).map((c) => c.hash)))
  }

  const firstSelected = commits?.find((c) => selected.has(c.hash))

  const run = async (): Promise<void> => {
    if (!commits || selected.size === 0) return
    setImporting(true)
    try {
      const flow: LessonNode = {
        id: newId(),
        parentId: null,
        type: 'FLOW',
        title: flowTitle.trim() || 'Importado do git',
        isExpanded: true,
        children: []
      }
      for (const commit of commits.filter((c) => selected.has(c.hash))) {
        const changes = await window.api.gitCommitChanges(rootPath, commit.hash)
        flow.children!.push(stepFromCommit(commit.subject, commit.body, changes, morph, flow.id))
      }
      useLessonStore.getState().appendNodes([flow])
      useIDEStore.getState().setActiveActivity('STEPS')
      useIDEStore.getState().notify(`${flow.children!.length} passos importados.`, 'success')
    } catch (e) {
      reportError(e, 'Não foi possível importar')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-5 p-8">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-light text-white">
            <GitBranch size={24} className="text-orange-300" /> Importar passos do git
          </h1>
          <p className="mt-2 text-[13px] text-gray-400">
            Desenvolva o projeto normalmente fazendo commits; cada commit escolhido vira um passo.
            Arquivos novos são criados, acréscimos e trocas pontuais viram digitação, e mudanças
            maiores viram uma transformação suave do arquivo.
          </p>
        </div>

        {error && (
          <p className="rounded bg-red-950/50 px-3 py-2 text-[13px] text-red-200">{error}</p>
        )}
        {!commits && !error && (
          <p className="flex items-center gap-2 text-[13px] text-gray-400">
            <Loader2 size={14} className="animate-spin" /> Lendo o histórico…
          </p>
        )}

        {commits && (
          <>
            <div className="grid grid-cols-2 gap-4 rounded border border-ide-border bg-ide-panel p-4 text-[13px]">
              <label className="flex flex-col gap-1 text-gray-300">
                Nome do fluxo
                <input
                  className="rounded border border-ide-border bg-ide-input px-2 py-1 text-white outline-none focus:border-ide-accent"
                  value={flowTitle}
                  onChange={(e) => setFlowTitle(e.target.value)}
                />
              </label>
              <label className="flex items-center gap-2 text-gray-300">
                <input
                  type="checkbox"
                  className="accent-sky-500"
                  checked={morph}
                  onChange={(e) => setMorph(e.target.checked)}
                />
                Usar sempre transformação suave em vez de digitação
              </label>
            </div>

            <div className="divide-y divide-ide-border rounded border border-ide-border">
              {commits.map((commit, index) => (
                <label
                  key={commit.hash}
                  className={clsx(
                    'flex cursor-pointer items-start gap-3 px-3 py-2 hover:bg-ide-hover',
                    selected.has(commit.hash) && 'bg-ide-select/30'
                  )}
                >
                  <input
                    type="checkbox"
                    className="mt-1 accent-sky-500"
                    checked={selected.has(commit.hash)}
                    onChange={() => toggle(commit.hash)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] text-white">{commit.subject}</div>
                    <div className="text-[11px] text-ide-muted">
                      {commit.hash.slice(0, 7)} · {new Date(commit.date).toLocaleString('pt-BR')}
                    </div>
                  </div>
                  <button
                    className="text-[11px] text-sky-400 hover:underline"
                    onClick={(e) => {
                      e.preventDefault()
                      selectFrom(index)
                    }}
                  >
                    daqui em diante
                  </button>
                </label>
              ))}
              {commits.length === 0 && (
                <p className="px-3 py-2 text-[13px] text-ide-muted">Nenhum commit encontrado.</p>
              )}
            </div>

            {firstSelected && (
              <p className="rounded bg-ide-panel px-3 py-2 text-[12px] text-gray-400">
                Para apresentar, deixe a pasta no estado de antes do primeiro commit escolhido, por
                exemplo com{' '}
                <code className="text-gray-200">
                  git checkout {firstSelected.hash.slice(0, 7)}~1
                </code>{' '}
                (ou uma cópia do projeto nesse ponto).
              </p>
            )}

            <button
              onClick={run}
              disabled={importing || selected.size === 0}
              className="flex items-center gap-2 rounded bg-ide-accent px-4 py-1.5 text-[13px] text-white hover:bg-sky-600 disabled:opacity-50"
            >
              {importing && <Loader2 size={14} className="animate-spin" />}
              Importar {selected.size} commit(s)
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default GitImportView
