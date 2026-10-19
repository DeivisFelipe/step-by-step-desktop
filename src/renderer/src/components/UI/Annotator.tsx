import { useEffect, useRef } from 'react'
import clsx from 'clsx'
import { Eraser, X } from 'lucide-react'
import { useAnnotatorStore } from '../../store/useAnnotatorStore'

const COLORS = ['#ef4444', '#facc15', '#22c55e', '#3b82f6', '#ffffff']

/** Free drawing over the whole window (F6). Esc closes and erases. */
const Pen = (): React.JSX.Element => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const color = useAnnotatorStore((s) => s.color)

  useEffect(() => {
    const canvas = canvasRef.current!
    const ratio = window.devicePixelRatio || 1
    const resize = (): void => {
      canvas.width = window.innerWidth * ratio
      canvas.height = window.innerHeight * ratio
      canvas.getContext('2d')!.scale(ratio, ratio)
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  const drawing = useRef<{ x: number; y: number } | null>(null)

  const onPointerDown = (e: React.PointerEvent): void => {
    e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = { x: e.clientX, y: e.clientY }
  }
  const onPointerMove = (e: React.PointerEvent): void => {
    const last = drawing.current
    if (!last) return
    const ctx = canvasRef.current!.getContext('2d')!
    ctx.strokeStyle = color
    ctx.lineWidth = 4
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(last.x, last.y)
    ctx.lineTo(e.clientX, e.clientY)
    ctx.stroke()
    drawing.current = { x: e.clientX, y: e.clientY }
  }
  const clear = (): void => {
    const canvas = canvasRef.current!
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height)
  }

  return (
    <>
      <canvas
        ref={canvasRef}
        className="fixed inset-0 z-[60] h-full w-full cursor-crosshair"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => (drawing.current = null)}
      />
      <div className="fixed left-1/2 top-3 z-[61] flex -translate-x-1/2 items-center gap-2 rounded-full border border-ide-border bg-ide-panel px-3 py-1.5 shadow-xl">
        {COLORS.map((c) => (
          <button
            key={c}
            onClick={() => useAnnotatorStore.getState().setColor(c)}
            className={clsx(
              'h-5 w-5 rounded-full border-2',
              c === color ? 'border-white' : 'border-transparent'
            )}
            style={{ background: c }}
            title="Cor"
          />
        ))}
        <button
          className="ml-1 rounded p-1 text-gray-300 hover:bg-ide-hover"
          onClick={clear}
          title="Apagar tudo"
        >
          <Eraser size={14} />
        </button>
        <button
          className="rounded p-1 text-gray-300 hover:bg-ide-hover"
          onClick={() => useAnnotatorStore.getState().close()}
          title="Fechar caneta (Esc)"
        >
          <X size={14} />
        </button>
      </div>
    </>
  )
}

/** Darkens the window except around the mouse (F7). Clicks pass through. */
const Spotlight = (): React.JSX.Element => {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onMove = (e: MouseEvent): void => {
      ref.current?.style.setProperty('--x', `${e.clientX}px`)
      ref.current?.style.setProperty('--y', `${e.clientY}px`)
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])
  return <div ref={ref} className="ssc-spotlight pointer-events-none fixed inset-0 z-[60]" />
}

const Annotator = (): React.JSX.Element | null => {
  const mode = useAnnotatorStore((s) => s.mode)
  if (mode === 'pen') return <Pen />
  if (mode === 'spotlight') return <Spotlight />
  return null
}

export default Annotator
