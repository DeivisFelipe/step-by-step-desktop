import { useState } from 'react'
import { ChevronDown, FolderClosed, FolderOpen, History } from 'lucide-react'
import ContextMenu, { ContextMenuItem } from './UI/ContextMenu'
import { useFileSystemStore } from '../store/useFileSystemStore'
import { basename } from '../lib/paths'
import { chooseWorkspace, closeWorkspace, getRecentFolders, openWorkspace } from '../lib/workspace'

/** Button with the current project's name that opens the project menu (open, recent, close). */
const ProjectMenu = ({ className }: { className?: string }): React.JSX.Element => {
  const rootPath = useFileSystemStore((s) => s.rootPath)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)

  const recent = getRecentFolders().filter((p) => p !== rootPath)
  const items: ContextMenuItem[] = [
    { label: 'Abrir outra pasta…', icon: FolderOpen, shortcut: 'Ctrl+O', action: chooseWorkspace },
    ...recent.map((path, i) => ({
      label: basename(path),
      icon: History,
      separator: i === 0,
      action: () => openWorkspace(path)
    })),
    ...(rootPath
      ? [
          {
            label: 'Fechar projeto',
            icon: FolderClosed,
            separator: true,
            action: closeWorkspace
          }
        ]
      : [])
  ]

  return (
    <>
      <button
        className={className}
        title={rootPath ? `${rootPath}\nClique para trocar de projeto` : 'Abrir um projeto'}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          // Opens below a button at the top (sidebar); the menu clamps itself above the status bar.
          const below = rect.top < window.innerHeight / 2
          setPosition({ x: rect.left, y: below ? rect.bottom + 4 : rect.top - 4 })
        }}
      >
        <FolderOpen size={13} />
        {rootPath ? basename(rootPath) : 'Abrir projeto'}
        <ChevronDown size={12} className="opacity-70" />
      </button>
      <ContextMenu position={position} items={items} onClose={() => setPosition(null)} />
    </>
  )
}

export default ProjectMenu
