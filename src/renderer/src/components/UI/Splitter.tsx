import clsx from 'clsx'

interface SplitterProps {
  axis: 'x' | 'y'
  size: number
  onResize: (size: number) => void
  /** Dragging towards the start grows the panel (e.g. a bottom panel). */
  invert?: boolean
}

const Splitter = ({ axis, size, onResize, invert }: SplitterProps): React.JSX.Element => {
  const onMouseDown = (e: React.MouseEvent): void => {
    e.preventDefault()
    const start = axis === 'x' ? e.clientX : e.clientY
    const startSize = size
    const onMove = (ev: MouseEvent): void => {
      const delta = (axis === 'x' ? ev.clientX : ev.clientY) - start
      onResize(startSize + (invert ? -delta : delta))
    }
    const onUp = (): void => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
    }
    document.body.style.cursor = axis === 'x' ? 'col-resize' : 'row-resize'
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div
      onMouseDown={onMouseDown}
      className={clsx(
        'relative z-10 flex-none bg-ide-border transition-colors hover:bg-ide-accent',
        axis === 'x' ? 'w-px cursor-col-resize' : 'h-px cursor-row-resize'
      )}
    >
      {/* Wider invisible hit area */}
      <div
        className={clsx('absolute', axis === 'x' ? '-inset-x-1 inset-y-0' : '-inset-y-1 inset-x-0')}
      />
    </div>
  )
}

export default Splitter
