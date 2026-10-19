import { useEffect, useState } from 'react'
import clsx from 'clsx'
import QRCode from 'qrcode'
import {
  Clapperboard,
  Copy,
  ExternalLink,
  FileDown,
  FileUp,
  FlaskConical,
  GitBranch,
  MonitorSmartphone,
  Pencil,
  Projector,
  RotateCcw,
  ScanEye,
  Settings,
  Timer,
  Users
} from 'lucide-react'
import { PRESENTATION_PAGES } from '../../../../shared/presentation'
import { useSettingsStore } from '../../store/useSettingsStore'
import { useIDEStore } from '../../store/useIDEStore'
import { chaptersText, usePlayerStore } from '../../store/usePlayerStore'
import { useFileSystemStore } from '../../store/useFileSystemStore'
import { useAnnotatorStore } from '../../store/useAnnotatorStore'
import { formatClock } from '../../../common/format'
import {
  exportGitRepository,
  exportHandout,
  exportLessonMarkdown,
  importLessonMarkdown
} from '../../lib/exporters'
import { SidebarHeader } from './FileExplorerHeader'

const Group = ({
  title,
  icon: Icon,
  children
}: {
  title: string
  icon: typeof Users
  children: React.ReactNode
}): React.JSX.Element => (
  <section className="border-b border-ide-border px-4 py-3">
    <h3 className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-ide-muted">
      <Icon size={13} /> {title}
    </h3>
    <div className="space-y-2 text-[12px]">{children}</div>
  </section>
)

const ActionButton = ({
  icon: Icon,
  children,
  onClick,
  disabled,
  active
}: {
  icon: typeof Users
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  active?: boolean
}): React.JSX.Element => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={clsx(
      'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] disabled:opacity-40',
      active ? 'bg-ide-select text-white' : 'bg-ide-input text-gray-200 hover:bg-ide-border'
    )}
  >
    <Icon size={14} className="flex-none" /> <span className="flex-1">{children}</span>
  </button>
)

const UrlRow = ({
  url,
  label,
  hint
}: {
  url: string
  label: string
  hint?: string
}): React.JSX.Element => (
  <div className="group flex items-center gap-1" title={hint}>
    <div className="min-w-0 flex-1">
      <div className="text-gray-200">{label}</div>
      <div className="truncate font-mono text-[10px] text-ide-muted">{url}</div>
    </div>
    <button
      className="rounded p-1 text-gray-400 hover:bg-ide-border hover:text-white"
      title="Copiar URL"
      onClick={() => {
        navigator.clipboard.writeText(url)
        useIDEStore.getState().notify('URL copiada.', 'success', 1500)
      }}
    >
      <Copy size={13} />
    </button>
    <button
      className="rounded p-1 text-gray-400 hover:bg-ide-border hover:text-white"
      title="Abrir no navegador"
      onClick={() => window.open(url, '_blank')}
    >
      <ExternalLink size={13} />
    </button>
  </div>
)

const QrCode = ({ value }: { value: string }): React.JSX.Element => {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    QRCode.toDataURL(value, { margin: 1, width: 180 }).then(setSrc)
  }, [value])
  return src ? (
    <img
      src={src}
      alt="QR code"
      className="mx-auto rounded bg-white p-1"
      width={180}
      height={180}
    />
  ) : (
    <div className="h-[180px]" />
  )
}

const Clock = (): React.JSX.Element => {
  const startedAt = usePlayerStore((s) => s.sessionStartedAt)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  return (
    <span className="font-mono text-[18px] tabular-nums text-white">
      {startedAt ? formatClock(now - startedAt) : '00:00'}
    </span>
  )
}

const PresentationPanel = (): React.JSX.Element => {
  const server = useSettingsStore((s) => s.server)
  const settings = useSettingsStore((s) => s.settings)
  const obs = useSettingsStore((s) => s.obs)
  const update = useSettingsStore((s) => s.update)
  const rootPath = useFileSystemStore((s) => s.rootPath)
  const annotator = useAnnotatorStore((s) => s.mode)
  const [showRemoteQr, setShowRemoteQr] = useState(false)
  const ide = useIDEStore.getState

  const local = server?.port ? server.localUrl : null
  const remoteBase = server?.lanUrl ?? local
  const remoteUrl = remoteBase && server ? `${remoteBase}/apresentador?token=${server.token}` : null

  return (
    <div className="flex h-full flex-col">
      <SidebarHeader
        title="Apresentação"
        actions={[
          {
            icon: Settings,
            title: 'Configurações',
            onClick: () => ide().openSpecialTab('SETTINGS')
          }
        ]}
      />
      <div className="flex-1 overflow-y-auto">
        <Group title="Páginas para o OBS" icon={Clapperboard}>
          {!local && <p className="text-yellow-300">{server?.error ?? 'Iniciando o servidor…'}</p>}
          {local && (
            <>
              <p className="text-ide-muted">
                No OBS: Fontes → + → Navegador, cole a URL e use 1920×1080.
              </p>
              {PRESENTATION_PAGES.map((page) => (
                <UrlRow
                  key={page.path}
                  url={`${local}/${page.path}`}
                  label={page.label}
                  hint={page.hint}
                />
              ))}
            </>
          )}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-ide-muted">Estilo:</span>
            <select
              className="flex-1 rounded border border-ide-border bg-ide-input px-1.5 py-1 text-white outline-none"
              value={settings.presentation.preset}
              onChange={(e) => update({ presentation: { preset: e.target.value } })}
            >
              {Object.keys(settings.presentation.presets).map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-ide-muted">OBS:</span>
            <span
              className={clsx(
                'flex-1',
                !settings.obs.enabled
                  ? 'text-ide-muted'
                  : obs?.connected
                    ? 'text-green-400'
                    : 'text-yellow-400'
              )}
            >
              {!settings.obs.enabled
                ? 'desligado'
                : obs?.connected
                  ? 'conectado'
                  : (obs?.error ?? 'conectando…')}
            </span>
            <button
              className="text-sky-400 hover:underline"
              onClick={() => ide().openSpecialTab('SETTINGS')}
            >
              configurar
            </button>
          </div>
        </Group>

        <Group title="Visão do apresentador" icon={MonitorSmartphone}>
          <ActionButton
            icon={ScanEye}
            onClick={() => window.api.openPresenterWindow()}
            disabled={!local}
          >
            Abrir em outra janela
          </ActionButton>
          <ActionButton
            icon={MonitorSmartphone}
            onClick={() => setShowRemoteQr(!showRemoteQr)}
            disabled={!remoteUrl}
          >
            Controlar pelo celular
          </ActionButton>
          {showRemoteQr && remoteUrl && (
            <div className="space-y-1 pt-1">
              {!server?.lanUrl && (
                <p className="text-yellow-300">
                  Ative “Compartilhar na rede local” abaixo para o celular conseguir acessar.
                </p>
              )}
              <QrCode value={remoteUrl} />
              <p className="text-center text-ide-muted">
                Notas, cronômetro e botões de avançar/voltar. Não compartilhe este código com a
                turma.
              </p>
            </div>
          )}
        </Group>

        <Group title="Turma" icon={Users}>
          <label className="flex cursor-pointer items-start gap-2 text-gray-200">
            <input
              type="checkbox"
              className="mt-0.5 accent-sky-500"
              checked={settings.server.shareOnLan}
              onChange={(e) => update({ server: { shareOnLan: e.target.checked } })}
            />
            <span>
              Compartilhar na rede local
              <span className="block text-ide-muted">
                Os alunos acompanham o código pelo celular ou notebook. O Windows pode pedir
                permissão no firewall.
              </span>
            </span>
          </label>
          {server?.lanUrl && (
            <div className="space-y-1">
              <QrCode value={`${server.lanUrl}/aluno`} />
              <UrlRow url={`${server.lanUrl}/aluno`} label="Página dos alunos" />
            </div>
          )}
        </Group>

        <Group title="Gravação" icon={Timer}>
          <div className="flex items-center justify-between">
            <Clock />
            <button
              className="flex items-center gap-1 text-sky-400 hover:underline"
              onClick={() => usePlayerStore.getState().restartClock()}
            >
              <RotateCcw size={12} /> zerar
            </button>
          </div>
          <ActionButton
            icon={Copy}
            onClick={() => {
              const text = chaptersText()
              if (!text) return ide().notify('Execute algum passo primeiro.', 'info')
              navigator.clipboard.writeText(text)
              ide().notify('Capítulos copiados (formato do YouTube).', 'success')
            }}
          >
            Copiar capítulos para o YouTube
          </ActionButton>
        </Group>

        <Group title="Durante a aula" icon={Projector}>
          <ActionButton
            icon={Projector}
            active={settings.projector}
            onClick={() => update({ projector: !settings.projector })}
          >
            Modo projetor (tudo maior)
          </ActionButton>
          <ActionButton
            icon={Pencil}
            active={annotator === 'pen'}
            onClick={() => useAnnotatorStore.getState().toggle('pen')}
          >
            Caneta <span className="text-ide-muted">F6</span>
          </ActionButton>
          <ActionButton
            icon={ScanEye}
            active={annotator === 'spotlight'}
            onClick={() => useAnnotatorStore.getState().toggle('spotlight')}
          >
            Holofote <span className="text-ide-muted">F7</span>
          </ActionButton>
          <ActionButton icon={FlaskConical} onClick={() => ide().openSpecialTab('REHEARSAL')}>
            Ensaiar a aula
          </ActionButton>
        </Group>

        <Group title="Importar e exportar" icon={FileDown}>
          <ActionButton icon={FileUp} onClick={importLessonMarkdown}>
            Importar aula (Markdown)
          </ActionButton>
          <ActionButton
            icon={GitBranch}
            onClick={() => ide().openSpecialTab('GIT_IMPORT')}
            disabled={!rootPath}
          >
            Criar passos a partir do git
          </ActionButton>
          <ActionButton icon={FileDown} onClick={exportLessonMarkdown}>
            Exportar aula (Markdown editável)
          </ActionButton>
          <ActionButton icon={FileDown} onClick={() => exportHandout('pdf')}>
            Apostila para os alunos (PDF)
          </ActionButton>
          <ActionButton icon={FileDown} onClick={() => exportHandout('md')}>
            Apostila para os alunos (Markdown)
          </ActionButton>
          <ActionButton icon={GitBranch} onClick={exportGitRepository} disabled={!rootPath}>
            Repositório git com um commit por passo
          </ActionButton>
        </Group>
      </div>
    </div>
  )
}

export default PresentationPanel
