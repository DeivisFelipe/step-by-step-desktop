import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { LucideIcon } from 'lucide-react'

export interface ContextMenuItem {
  label: string
  action: () => void
  icon?: LucideIcon
  danger?: boolean
  disabled?: boolean
  shortcut?: string
  /** Draws a separator above this item. */
  separator?: boolean
}

interface ContextMenuProps {
  position: { x: number; y: number } | null
  items: ContextMenuItem[]
  onClose: () => void
}

const ContextMenu = ({ position, items, onClose }: ContextMenuProps): React.JSX.Element | null => {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!position) return
    const onMouseDown = (event: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) onClose()
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('blur', onClose)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('blur', onClose)
    }
  }, [position, onClose])

  if (!position) return null

  // Keep the menu inside the window.
  const placeInViewport = (el: HTMLDivElement | null): void => {
    menuRef.current = el
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (position.x + rect.width > window.innerWidth) {
      el.style.left = `${Math.max(4, window.innerWidth - rect.width - 4)}px`
    }
    if (position.y + rect.height > window.innerHeight) {
      el.style.top = `${Math.max(4, window.innerHeight - rect.height - 4)}px`
    }
  }

  return createPortal(
    <div
      ref={placeInViewport}
      className="fixed z-50 min-w-[200px] rounded border border-[#454545] bg-ide-panel py-1 shadow-xl"
      style={{ top: position.y, left: position.x }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, index) => (
        <div key={index}>
          {item.separator && <div className="my-1 h-px bg-ide-border" />}
          <div
            className={clsx(
              'flex items-center px-3 py-1.5 text-[13px] transition-colors',
              item.disabled
                ? 'cursor-default text-gray-600'
                : 'cursor-pointer hover:bg-ide-select hover:text-white',
              !item.disabled && (item.danger ? 'text-red-400' : 'text-ide-text')
            )}
            onClick={(e) => {
              e.stopPropagation()
              if (item.disabled) return
              onClose()
              item.action()
            }}
          >
            <span className="mr-2 w-4 flex-none">{item.icon && <item.icon size={14} />}</span>
            <span className="flex-1">{item.label}</span>
            {item.shortcut && <span className="ml-6 text-xs text-ide-muted">{item.shortcut}</span>}
          </div>
        </div>
      ))}
    </div>,
    document.body
  )
}

export default ContextMenu
