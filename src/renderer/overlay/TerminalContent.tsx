import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { onTerminal, onTerminalSize, terminalBuffer, terminalWidth } from './connection'

/**
 * Read-only mirror of one of the app's terminals. It uses the app terminal's
 * column count (shrinking the font if needed) so lines wrap exactly the same.
 */
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

    const layout = (): void => {
      if (container.offsetWidth === 0) return
      try {
        const cols = terminalId !== null ? terminalWidth(terminalId) : null
        term.options.fontSize = fontSize
        const proposed = fit.proposeDimensions()
        if (!proposed) return
        if (cols && proposed.cols < cols) {
          // Shrink the font until the app's columns fit the width.
          term.options.fontSize = Math.max(8, Math.floor((fontSize * proposed.cols) / cols))
        }
        const rows = fit.proposeDimensions()?.rows ?? proposed.rows
        term.resize(cols ?? proposed.cols, Math.max(rows, 2))
      } catch {
        // not ready
      }
    }
    layout()
    if (terminalId !== null) term.write(terminalBuffer(terminalId))
    const offData = onTerminal((id, data, snapshot) => {
      if (id !== terminalId) return
      if (snapshot) term.reset()
      term.write(data)
    })
    const offSize = onTerminalSize((id) => id === terminalId && layout())
    const observer = new ResizeObserver(layout)
    observer.observe(container)
    return () => {
      offData()
      offSize()
      observer.disconnect()
      term.dispose()
    }
  }, [terminalId, fontSize, fontFamily, background, foreground])

  return (
    <div className="h-full w-full" style={{ padding: fontSize * 0.6, background }}>
      <div ref={containerRef} className="h-full w-full overflow-hidden" />
    </div>
  )
}
