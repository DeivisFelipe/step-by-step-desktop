import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { Eraser, Plus, RotateCw, X } from 'lucide-react'
import { useFileSystemStore } from '../../store/useFileSystemStore'
import { useIDEStore } from '../../store/useIDEStore'
import { TerminalSession, useTerminalStore } from '../../store/useTerminalStore'
import { useStageStore } from '../../store/useStageStore'
import { useSettingsStore } from '../../store/useSettingsStore'
import { appendTerminalOutput, getTerminalId, setTerminalId } from '../../lib/registry'
import { basename } from '../../lib/paths'

const TERMINAL_THEME = {
  background: '#1e1e1e',
  foreground: '#cccccc',
  cursor: '#aeafad',
  selectionBackground: '#264f78',
  black: '#000000',
  red: '#cd3131',
  green: '#0dbc79',
  yellow: '#e5e510',
  blue: '#2472c8',
  magenta: '#bc3fbc',
  cyan: '#11a8cd',
  white: '#e5e5e5',
  brightBlack: '#666666',
  brightRed: '#f14c4c',
  brightGreen: '#23d18b',
  brightYellow: '#f5f543',
  brightBlue: '#3b8eea',
  brightMagenta: '#d670d6',
  brightCyan: '#29b8db',
  brightWhite: '#e5e5e5'
}

const shellLabel = (path: string): string => basename(path).replace(/\.exe$/i, '')

/** Clears handles registered per terminal (restart and clear buttons). */
const instances = new Map<string, { term: Terminal; restart: () => void }>()

/** One shell session. Stays mounted while hidden so the process survives. */
const TerminalInstance = ({
  session,
  defaultShell,
  visible
}: {
  session: TerminalSession
  defaultShell: string
  visible: boolean
}): React.JSX.Element => {
  const shell = session.shell || defaultShell
  const containerRef = useRef<HTMLDivElement>(null)
  const rootPath = useFileSystemStore((s) => s.rootPath)
  const projector = useSettingsStore((s) => s.settings.projector)
  const [generation, setGeneration] = useState(0)

  useEffect(() => {
    const container = containerRef.current
    if (!shell || !container) return

    const term = new Terminal({
      cursorBlink: true,
      fontSize: projector ? 20 : 14,
      fontFamily: "'Cascadia Mono', Consolas, 'Courier New', monospace",
      theme: TERMINAL_THEME,
      allowProposedApi: true,
      scrollback: 5000
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(container)
    instances.set(session.key, { term, restart: () => setGeneration((g) => g + 1) })

    let id: number | null = null
    let exited = false
    let disposed = false
    const pending: [number, string][] = []

    const syncSize = (): void => {
      if (disposed || container.offsetWidth === 0 || container.offsetHeight === 0) return
      try {
        fit.fit()
        if (id !== null) window.api.resizeTerminal(id, term.cols, term.rows)
      } catch {
        // terminal not ready yet
      }
    }

    const offData = window.api.onTerminalData((tid, data) => {
      if (tid === id) {
        term.write(data)
        appendTerminalOutput(tid, data)
      } else if (id === null) pending.push([tid, data])
    })
    const offExit = window.api.onTerminalExit((tid, code) => {
      if (tid !== id) return
      exited = true
      term.writeln(
        `\r\n\x1b[90m[processo encerrado (código ${code ?? '?'}) — pressione Enter para reiniciar]\x1b[0m`
      )
    })

    // Ctrl+C copies when there is a selection, otherwise it goes to the shell.
    // Ctrl+V is left to the browser, which fires a paste event xterm already handles.
    term.attachCustomKeyEventHandler((e) => {
      if (e.type !== 'keydown' || !e.ctrlKey) return true
      if (e.key === 'c' && term.hasSelection()) {
        navigator.clipboard.writeText(term.getSelection())
        term.clearSelection()
        return false
      }
      return e.key !== 'v'
    })

    const input = term.onData((data) => {
      if (exited) {
        if (data === '\r') setGeneration((g) => g + 1)
        return
      }
      if (id !== null) window.api.sendTerminalInput(id, data)
    })

    window.api.createTerminal({ shell, cwd: rootPath ?? undefined }).then((tid) => {
      if (disposed) {
        window.api.killTerminal(tid)
        return
      }
      id = tid
      setTerminalId(session.key, tid)
      for (const [pid, data] of pending) {
        if (pid === tid) {
          term.write(data)
          appendTerminalOutput(tid, data)
        }
      }
      pending.length = 0
      syncSize()
    })

    const observer = new ResizeObserver(() => syncSize())
    observer.observe(container)

    return () => {
      disposed = true
      observer.disconnect()
      offData()
      offExit()
      input.dispose()
      term.dispose()
      instances.delete(session.key)
      if (id !== null) {
        window.api.killTerminal(id)
        if (getTerminalId(session.key) === id) setTerminalId(session.key, null)
      }
    }
  }, [shell, rootPath, generation, session.key, projector])

  return (
    <div className={clsx('h-full w-full', !visible && 'hidden')}>
      <div ref={containerRef} className="h-full w-full" />
    </div>
  )
}

const TerminalPanel = (): React.JSX.Element => {
  const sessions = useTerminalStore((s) => s.sessions)
  const activeKey = useTerminalStore((s) => s.activeKey)
  const [shells, setShells] = useState<string[]>([])
  const defaultShell = shells[0] || ''
  const activeShell = sessions.find((s) => s.key === activeKey)?.shell || defaultShell

  useEffect(() => {
    window.api.getAvailableShells().then(setShells)
  }, [])

  const button = 'rounded p-1 text-gray-400 hover:bg-ide-border hover:text-white'
  const terminals = useTerminalStore.getState

  const select = (key: string): void => {
    terminals().setActive(key)
    useStageStore.getState().setTerminal(key)
  }

  return (
    <div className="flex h-full flex-col bg-ide-bg">
      <div className="flex h-8 flex-none items-center gap-1 px-2 text-[11px] uppercase tracking-wider">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {sessions.map((s) => (
            <div
              key={s.key}
              className={clsx(
                'group flex flex-none cursor-pointer items-center gap-1 border-b px-2 pb-0.5 pt-1 normal-case',
                s.key === activeKey
                  ? 'border-ide-accent text-white'
                  : 'border-transparent text-ide-muted hover:text-gray-200'
              )}
              onClick={() => select(s.key)}
              onDoubleClick={async () => {
                const name = await useIDEStore.getState().askText('Nome do terminal', s.name)
                if (name) terminals().rename(s.key, name)
              }}
              title="Duplo clique para renomear"
            >
              {s.name}
              {sessions.length > 1 && (
                <button
                  className="invisible rounded hover:bg-ide-border group-hover:visible"
                  onClick={(e) => {
                    e.stopPropagation()
                    terminals().remove(s.key)
                  }}
                  title="Fechar terminal"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
          <button
            className={button}
            title="Novo terminal"
            onClick={() => select(terminals().add())}
          >
            <Plus size={14} />
          </button>
        </div>
        <select
          className="rounded border border-ide-border bg-ide-input px-1.5 py-0.5 text-[12px] normal-case text-white outline-none"
          value={activeShell}
          onChange={(e) => terminals().setShell(activeKey, e.target.value)}
          title="Shell do terminal atual"
        >
          {shells.map((s) => (
            <option key={s} value={s}>
              {shellLabel(s)}
            </option>
          ))}
        </select>
        <button
          className={button}
          title="Limpar"
          onClick={() => instances.get(activeKey)?.term.clear()}
        >
          <Eraser size={14} />
        </button>
        <button
          className={button}
          title="Reiniciar terminal"
          onClick={() => instances.get(activeKey)?.restart()}
        >
          <RotateCw size={14} />
        </button>
        <button
          className={button}
          title="Ocultar terminal (Ctrl+J)"
          onClick={() => useIDEStore.getState().setTerminalVisible(false)}
        >
          <X size={14} />
        </button>
      </div>
      <div className="min-h-0 flex-1 pl-3 pt-1">
        {sessions.map((s) => (
          <TerminalInstance
            key={s.key}
            session={s}
            defaultShell={defaultShell}
            visible={s.key === activeKey}
          />
        ))}
      </div>
    </div>
  )
}

export default TerminalPanel
