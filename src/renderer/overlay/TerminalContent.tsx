import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { onTerminal, terminalLog } from './connection'

/**
 * Read-only mirror of one of the app's terminals. It always has the app terminal's rows
 * and columns (the shell moves the cursor by position, so any other size mixes the lines)
 * and shrinks the font until that grid fits.
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
    let size = { cols: 80, rows: 24 }

    /** Largest font (up to `fontSize`) that fits the terminal grid in the container. */
    const fitFont = (): void => {
      if (container.offsetWidth === 0) return
      let font = fontSize
      term.options.fontSize = font
      for (let i = 0; i < 40; i++) {
        const proposed = fit.proposeDimensions()
        if (!proposed || (proposed.cols >= size.cols && proposed.rows >= size.rows)) return
        const scale = Math.min(proposed.cols / size.cols, proposed.rows / size.rows)
        const next = Math.max(6, Math.min(font - 1, Math.floor(font * scale)))
        if (next === font) return
        font = next
        term.options.fontSize = font
      }
    }

    const applySize = (cols: number, rows: number): void => {
      size = { cols, rows }
      try {
        term.resize(cols, rows)
      } catch {
        // not ready
      }
      fitFont()
    }

    // Size changes wait for the output already queued, so each piece is drawn at its size.
    const queueSize = (cols: number, rows: number): void => {
      term.write('', () => applySize(cols, rows))
    }

    const replay = (): void => {
      term.reset()
      if (terminalId === null) return
      for (const segment of terminalLog(terminalId)) {
        queueSize(segment.cols, segment.rows)
        term.write(segment.data)
      }
    }

    replay()
    const off = onTerminal((id, event) => {
      if (id !== terminalId) return
      if (event.type === 'replay') replay()
      else if (event.type === 'size') queueSize(event.cols, event.rows)
      else term.write(event.data)
    })
    const observer = new ResizeObserver(fitFont)
    observer.observe(container)
    return () => {
      off()
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
