import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { onTerminal, terminalBuffer } from './connection'

/** Read-only mirror of one of the app's terminals. */
export const TerminalContent = ({
  terminalId,
  fontSize,
  fontFamily,
  background,
  foreground
}: {
  terminalId: number | null
  fontSize: number
  fontFamily: string
  background: string
  foreground: string
}): React.JSX.Element => {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const term = new Terminal({
      disableStdin: true,
      cursorBlink: false,
      fontSize,
      fontFamily,
      scrollback: 2000,
      theme: { background, foreground, cursor: foreground }
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(container)
    const doFit = (): void => {
      try {
        if (container.offsetWidth > 0) fit.fit()
      } catch {
        // not ready
      }
    }
    doFit()
    if (terminalId !== null) term.write(terminalBuffer(terminalId))
    const off = onTerminal((id, data, snapshot) => {
      if (id !== terminalId) return
      if (snapshot) term.reset()
      term.write(data)
    })
    const observer = new ResizeObserver(doFit)
    observer.observe(container)
    return () => {
      off()
      observer.disconnect()
      term.dispose()
    }
  }, [terminalId, fontSize, fontFamily, background, foreground])

  return (
    <div className="h-full w-full" style={{ padding: fontSize * 0.6, background }}>
      <div ref={containerRef} className="h-full w-full" />
    </div>
  )
}
