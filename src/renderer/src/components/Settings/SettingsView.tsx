import { useState } from 'react'
import clsx from 'clsx'
import { Copy, Plus, RotateCcw, Trash } from 'lucide-react'
import { useSettingsStore } from '../../store/useSettingsStore'
import { reportError, useIDEStore } from '../../store/useIDEStore'
import { restartToUpdate } from '../../lib/updates'
import {
  Aspect,
  BUILTIN_PRESETS,
  PresentationStyle,
  SHIKI_THEMES,
  StageView,
  resolveStyle
} from '../../../../shared/presentation'

const input =
  'rounded border border-ide-border bg-ide-input px-2 py-1 text-[13px] text-white outline-none focus:border-ide-accent'

const Row = ({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element => (
  <label className="grid grid-cols-[180px_1fr] items-center gap-3 text-[13px] text-gray-300">
    <span>{label}</span>
    <div className="flex items-center gap-2">{children}</div>
  </label>
)

const Section = ({
  title,
  description,
  children
}: {
  title: string
  description?: string
  children: React.ReactNode
}): React.JSX.Element => (
  <section className="space-y-3 rounded border border-ide-border bg-ide-panel p-5">
    <div>
      <h2 className="text-[15px] font-semibold text-white">{title}</h2>
      {description && <p className="mt-1 text-[12px] text-ide-muted">{description}</p>}
    </div>
    {children}
  </section>
)

const BACKGROUNDS = [
  'linear-gradient(135deg, #4f46e5 0%, #9333ea 50%, #db2777 100%)',
  'linear-gradient(140deg, #0ea5e9 0%, #0f766e 100%)',
  'linear-gradient(135deg, #f97316 0%, #db2777 100%)',
  'linear-gradient(135deg, #22c55e 0%, #0ea5e9 100%)',
  'linear-gradient(180deg, #111827 0%, #312e81 100%)',
  'linear-gradient(135deg, #e0e7ff 0%, #fce7f3 100%)',
  '#0f172a',
  '#00ff00'
]

const VIEWS: { view: StageView; label: string }[] = [
  { view: 'code', label: 'Código' },
  { view: 'terminal', label: 'Terminal' },
  { view: 'slide', label: 'Slide' },
  { view: 'challenge', label: 'Desafio' },
  { view: 'preview', label: 'Preview' }
]

const StyleEditor = (): React.JSX.Element => {
  const settings = useSettingsStore((s) => s.settings)
  const server = useSettingsStore((s) => s.server)
  const update = useSettingsStore((s) => s.update)
  const presetName = settings.presentation.preset
  const style = resolveStyle(settings)
  const [previewKey, setPreviewKey] = useState(0)

  const save = async (patch: Partial<PresentationStyle>): Promise<void> => {
    try {
      useSettingsStore.setState({
        settings: await window.api.savePreset(presetName, { ...style, ...patch })
      })
    } catch (e) {
      reportError(e)
    }
  }

  const duplicate = async (): Promise<void> => {
    const name = await useIDEStore.getState().askText('Nome do novo estilo', `${presetName} 2`)
    if (!name) return
    await window.api.savePreset(name, style)
    await update({ presentation: { preset: name } })
  }

  const remove = async (): Promise<void> => {
    useSettingsStore.setState({ settings: await window.api.savePreset(presetName, null) })
  }

  const isBuiltin = !!BUILTIN_PRESETS[presetName]
  const previewUrl = server?.port
    ? `${server.localUrl}/palco?demo=1&estilo=${encodeURIComponent(presetName)}`
    : null
  const ratio = style.aspect === 'livre' ? '16 / 9' : style.aspect.replace(':', ' / ')

  return (
    <Section
      title="Estilo da apresentação"
      description="Como o código, o terminal e os slides aparecem nas páginas para o OBS e no projetor. Use ?estilo=Nome na URL para escolher outro estilo numa fonte específica."
    >
      <Row label="Estilo">
        <select
          className={clsx(input, 'flex-1')}
          value={presetName}
          onChange={(e) => update({ presentation: { preset: e.target.value } })}
        >
          {Object.keys(settings.presentation.presets).map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
        <button
          className="rounded p-1.5 hover:bg-ide-hover"
          title="Duplicar estilo"
          onClick={duplicate}
        >
          <Plus size={14} />
        </button>
        <button
          className="rounded p-1.5 hover:bg-ide-hover"
          title={isBuiltin ? 'Restaurar o original' : 'Excluir estilo'}
          onClick={remove}
        >
          {isBuiltin ? <RotateCcw size={14} /> : <Trash size={14} />}
        </button>
      </Row>

      <div className="grid grid-cols-[1fr_340px] gap-6">
        <div className="space-y-3">
          <Row label="Proporção">
            <select
              className={input}
              value={style.aspect}
              onChange={(e) => save({ aspect: e.target.value as Aspect })}
            >
              <option value="16:9">16:9 (paisagem)</option>
              <option value="4:3">4:3</option>
              <option value="1:1">1:1 (quadrado)</option>
              <option value="9:16">9:16 (vertical / Shorts)</option>
              <option value="livre">Livre (ocupa a fonte toda)</option>
            </select>
          </Row>
          <Row label="Fundo transparente">
            <input
              type="checkbox"
              className="accent-sky-500"
              checked={style.transparent}
              onChange={(e) => save({ transparent: e.target.checked })}
            />
            <span className="text-[12px] text-ide-muted">para sobrepor à câmera no OBS</span>
          </Row>
          {!style.transparent && (
            <Row label="Fundo">
              <div className="flex flex-wrap gap-1.5">
                {BACKGROUNDS.map((bg) => (
                  <button
                    key={bg}
                    title={bg === '#00ff00' ? 'Chroma key' : bg}
                    onClick={() => save({ background: bg })}
                    className={clsx(
                      'h-6 w-8 rounded border-2',
                      style.background === bg ? 'border-white' : 'border-transparent'
                    )}
                    style={{ background: bg }}
                  />
                ))}
              </div>
            </Row>
          )}
          {!style.transparent && (
            <Row label="CSS do fundo">
              <input
                className={clsx(input, 'flex-1 font-mono text-[11px]')}
                value={style.background}
                onChange={(e) => save({ background: e.target.value })}
              />
            </Row>
          )}
          <Row label="Janela">
            <select
              className={input}
              value={style.chrome}
              onChange={(e) => save({ chrome: e.target.value as PresentationStyle['chrome'] })}
            >
              <option value="mac">macOS</option>
              <option value="windows">Windows</option>
              <option value="none">Sem moldura</option>
            </select>
            <label className="ml-3 flex items-center gap-1.5">
              <input
                type="checkbox"
                className="accent-sky-500"
                checked={style.showTitle}
                onChange={(e) => save({ showTitle: e.target.checked })}
              />
              nome do arquivo
            </label>
          </Row>
          <Row label="Tema de cores">
            <select
              className={input}
              value={style.theme}
              onChange={(e) => save({ theme: e.target.value })}
            >
              {SHIKI_THEMES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Row>
          <Row label="Tamanho da fonte">
            <input
              type="range"
              min={12}
              max={48}
              value={style.fontSize}
              onChange={(e) => save({ fontSize: Number(e.target.value) })}
              className="flex-1 accent-sky-500"
            />
            <span className="w-10 text-right tabular-nums">{style.fontSize}px</span>
          </Row>
          <Row label="Espaçamento">
            <input
              type="range"
              min={0}
              max={160}
              step={4}
              value={style.padding}
              onChange={(e) => save({ padding: Number(e.target.value) })}
              className="flex-1 accent-sky-500"
            />
            <span className="w-10 text-right tabular-nums">{style.padding}px</span>
          </Row>
          <Row label="Cantos arredondados">
            <input
              type="range"
              min={0}
              max={32}
              value={style.radius}
              onChange={(e) => save({ radius: Number(e.target.value) })}
              className="flex-1 accent-sky-500"
            />
            <span className="w-10 text-right tabular-nums">{style.radius}px</span>
          </Row>
          <Row label="Detalhes">
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                className="accent-sky-500"
                checked={style.lineNumbers}
                onChange={(e) => save({ lineNumbers: e.target.checked })}
              />
              números de linha
            </label>
            <label className="ml-3 flex items-center gap-1.5">
              <input
                type="checkbox"
                className="accent-sky-500"
                checked={style.shadow}
                onChange={(e) => save({ shadow: e.target.checked })}
              />
              sombra
            </label>
          </Row>
          <Row label="Legenda no palco">
            <select
              className={input}
              value={style.captionPosition}
              onChange={(e) =>
                save({ captionPosition: e.target.value as PresentationStyle['captionPosition'] })
              }
            >
              <option value="bottom">Embaixo</option>
              <option value="top">Em cima</option>
              <option value="none">Não mostrar (use a página Legenda)</option>
            </select>
            <input
              type="number"
              min={12}
              max={72}
              className={clsx(input, 'w-20')}
              value={style.captionSize}
              onChange={(e) => save({ captionSize: Number(e.target.value) || 28 })}
              title="Tamanho da legenda"
            />
          </Row>
          <Row label="Duração do magic move">
            <input
              type="range"
              min={200}
              max={2000}
              step={100}
              value={style.morphDuration}
              onChange={(e) => save({ morphDuration: Number(e.target.value) })}
              className="flex-1 accent-sky-500"
            />
            <span className="w-14 text-right tabular-nums">{style.morphDuration} ms</span>
          </Row>
          <Row label="Fonte">
            <input
              className={clsx(input, 'flex-1 font-mono text-[11px]')}
              value={style.fontFamily}
              onChange={(e) => save({ fontFamily: e.target.value })}
            />
          </Row>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-[12px] text-ide-muted">
            <span>Prévia (/palco)</span>
            <button className="hover:text-white" onClick={() => setPreviewKey((k) => k + 1)}>
              recarregar
            </button>
          </div>
          {previewUrl ? (
            <div
              className="w-full overflow-hidden rounded border border-ide-border"
              style={{
                aspectRatio: ratio,
                background: 'repeating-conic-gradient(#333 0% 25%, #222 0% 50%) 0 0 / 16px 16px'
              }}
            >
              <iframe
                key={previewKey}
                src={previewUrl}
                title="Prévia do estilo"
                className="pointer-events-none origin-top-left"
                style={{ width: '400%', height: '400%', transform: 'scale(0.25)' }}
              />
            </div>
          ) : (
            <p className="text-[12px] text-ide-muted">Servidor de apresentação parado.</p>
          )}
        </div>
      </div>
    </Section>
  )
}

const ObsSection = (): React.JSX.Element => {
  const obsSettings = useSettingsStore((s) => s.settings.obs)
  const status = useSettingsStore((s) => s.obs)
  const update = useSettingsStore((s) => s.update)
  const [password, setPassword] = useState(obsSettings.password)

  return (
    <Section
      title="OBS Studio"
      description="No OBS: Ferramentas → Configurações do servidor WebSocket → Ativar. O app troca de cena conforme o tipo de passo e marca capítulos na gravação."
    >
      <Row label="Conectar ao OBS">
        <input
          type="checkbox"
          className="accent-sky-500"
          checked={obsSettings.enabled}
          onChange={(e) => update({ obs: { enabled: e.target.checked } })}
        />
        {obsSettings.enabled && (
          <span
            className={clsx(
              'text-[12px]',
              status?.connected ? 'text-green-400' : 'text-yellow-400'
            )}
          >
            {status?.connected ? '● conectado' : `● ${status?.error ?? 'conectando…'}`}
          </span>
        )}
      </Row>
      <Row label="Endereço">
        <input
          className={clsx(input, 'w-40')}
          value={obsSettings.host}
          onChange={(e) => update({ obs: { host: e.target.value } })}
        />
        <span>:</span>
        <input
          type="number"
          className={clsx(input, 'w-24')}
          value={obsSettings.port}
          onChange={(e) => update({ obs: { port: Number(e.target.value) || 4455 } })}
        />
      </Row>
      <Row label="Senha">
        <input
          type="password"
          className={clsx(input, 'w-64')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => password !== obsSettings.password && update({ obs: { password } })}
        />
      </Row>
      <Row label="Capítulos na gravação">
        <input
          type="checkbox"
          className="accent-sky-500"
          checked={obsSettings.chapters}
          onChange={(e) => update({ obs: { chapters: e.target.checked } })}
        />
        <span className="text-[12px] text-ide-muted">
          um capítulo por passo (OBS 30.2+, formato MP4 híbrido)
        </span>
      </Row>
      <div className="pt-2 text-[12px] font-semibold text-gray-400">
        Cena para cada tipo de passo
      </div>
      {VIEWS.map(({ view, label }) => (
        <Row key={view} label={label}>
          <select
            className={clsx(input, 'w-64')}
            value={obsSettings.scenes[view] ?? ''}
            onChange={(e) => update({ obs: { scenes: { [view]: e.target.value } } })}
          >
            <option value="">(não trocar)</option>
            {[...new Set([...(status?.scenes ?? []), obsSettings.scenes[view] ?? ''])]
              .filter(Boolean)
              .map((scene) => (
                <option key={scene}>{scene}</option>
              ))}
          </select>
        </Row>
      ))}
    </Section>
  )
}

const UPDATE_TEXT: Record<string, string> = {
  disabled: 'atualizações automáticas só funcionam na versão instalada',
  idle: '',
  checking: 'procurando atualizações…',
  none: 'você está na versão mais recente',
  available: 'nova versão encontrada',
  downloading: 'baixando a nova versão…',
  ready: 'nova versão pronta para instalar',
  error: 'não foi possível verificar'
}

const VersionRow = (): React.JSX.Element => {
  const updater = useSettingsStore((s) => s.updater)
  if (!updater) return <></>
  return (
    <Row label="Versão">
      <span className="tabular-nums text-white">{updater.current}</span>
      <span className="text-[12px] text-ide-muted">
        {updater.state === 'downloading'
          ? `baixando ${updater.version} (${updater.percent}%)`
          : updater.state === 'ready'
            ? `versão ${updater.version} pronta para instalar`
            : updater.state === 'error'
              ? `${UPDATE_TEXT.error}: ${updater.error ?? ''}`
              : UPDATE_TEXT[updater.state]}
      </span>
      {updater.state === 'ready' ? (
        <button className="text-[12px] text-green-400 hover:underline" onClick={restartToUpdate}>
          reiniciar e atualizar
        </button>
      ) : (
        updater.state !== 'disabled' && (
          <button
            className="text-[12px] text-sky-400 hover:underline disabled:opacity-50"
            disabled={updater.state === 'checking' || updater.state === 'downloading'}
            onClick={() => window.api.checkForUpdates()}
          >
            verificar atualizações
          </button>
        )
      )}
    </Row>
  )
}

const GeneralSection = (): React.JSX.Element => {
  const settings = useSettingsStore((s) => s.settings)
  const server = useSettingsStore((s) => s.server)
  const update = useSettingsStore((s) => s.update)

  return (
    <Section title="Geral">
      <VersionRow />
      <Row label="Passador de slides">
        <input
          type="checkbox"
          className="accent-sky-500"
          checked={settings.keys.clicker}
          onChange={(e) => update({ keys: { clicker: e.target.checked } })}
        />
        <span className="text-[12px] text-ide-muted">
          PageDown avança e PageUp volta (as teclas que os passadores enviam)
        </span>
      </Row>
      <Row label="Modo projetor">
        <input
          type="checkbox"
          className="accent-sky-500"
          checked={settings.projector}
          onChange={(e) => update({ projector: e.target.checked })}
        />
        <span className="text-[12px] text-ide-muted">interface, editor e terminal maiores</span>
      </Row>
      <Row label="Porta do servidor">
        <input
          type="number"
          className={clsx(input, 'w-24')}
          value={settings.server.port}
          onChange={(e) => update({ server: { port: Number(e.target.value) || 4545 } })}
        />
        {server && (
          <span className="text-[12px] text-ide-muted">
            {server.error ?? `em uso: ${server.localUrl}`}
          </span>
        )}
      </Row>
      <Row label="Chave do controle remoto">
        <code className="text-[12px] text-gray-400">{settings.server.token}</code>
        <button
          className="rounded p-1 hover:bg-ide-hover"
          title="Copiar"
          onClick={() => navigator.clipboard.writeText(settings.server.token)}
        >
          <Copy size={13} />
        </button>
        <button
          className="text-[12px] text-sky-400 hover:underline"
          onClick={() =>
            update({ server: { token: crypto.randomUUID().replace(/-/g, '').slice(0, 24) } })
          }
        >
          gerar nova
        </button>
      </Row>
    </Section>
  )
}

const SettingsView = (): React.JSX.Element => (
  <div className="h-full overflow-y-auto">
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <h1 className="text-2xl font-light text-white">Configurações</h1>
      <StyleEditor />
      <ObsSection />
      <GeneralSection />
    </div>
  </div>
)

export default SettingsView
