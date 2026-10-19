import { useState } from 'react'
import clsx from 'clsx'
import { ChevronRight, Copy, Edit, ExternalLink, FilePlus, FolderPlus, Trash } from 'lucide-react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { FileNode, useFileSystemStore } from '../../store/useFileSystemStore'
import { reportError, useIDEStore } from '../../store/useIDEStore'
import ContextMenu, { ContextMenuItem } from '../UI/ContextMenu'
import { FileIcon } from '../UI/FileIcon'
import { FileInput } from './FileInput'
import { dirname, joinPath, relativeTo } from '../../lib/paths'

export interface EditingState {
  type: 'rename' | 'createFile' | 'createFolder'
  /** Node being renamed, or the directory where the new item goes. */
  path: string
}

interface FileItemProps {
  node: FileNode
  depth: number
  editing: EditingState | null
  setEditing: (state: EditingState | null) => void
  onCreateIn: (dir: string, type: 'createFile' | 'createFolder') => void
  onDelete: (node: FileNode) => void
}

export const FileItem = ({
  node,
  depth,
  editing,
  setEditing,
  onCreateIn,
  onDelete
}: FileItemProps): React.JSX.Element => {
  const isExpanded = useFileSystemStore((s) => !!s.expanded[node.path])
  const isSelected = useFileSystemStore((s) => s.selectedPath === node.path)
  const isDirty = useFileSystemStore((s) => {
    const f = s.files[node.path]
    return !!f && f.content !== f.savedContent
  })
  const isActiveTab = useIDEStore((s) => s.activeTabId === node.path)
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null)

  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging
  } = useDraggable({
    id: node.path
  })
  // Dropping on a file moves into that file's folder.
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `drop:${node.path}`,
    data: { dir: node.isDirectory ? node.path : dirname(node.path) }
  })
  const setRowRef = (el: HTMLDivElement | null): void => {
    setDragRef(el)
    setDropRef(el)
  }

  const handleClick = (e: React.MouseEvent): void => {
    e.stopPropagation()
    const fs = useFileSystemStore.getState()
    fs.select(node.path)
    if (node.isDirectory) fs.toggleDirectory(node.path)
    else useIDEStore.getState().openFileTab(node.path)
  }

  const handleRename = async (newName: string): Promise<void> => {
    setEditing(null)
    try {
      await useFileSystemStore
        .getState()
        .renameNode(node.path, joinPath(dirname(node.path), newName))
    } catch (e) {
      reportError(e, 'Não foi possível renomear')
    }
  }

  const handleCreate = async (name: string): Promise<void> => {
    const type = editing?.type
    setEditing(null)
    const target = joinPath(node.path, name)
    try {
      if (type === 'createFolder') await useFileSystemStore.getState().createDirectory(target)
      else await useFileSystemStore.getState().createFile(target)
    } catch (e) {
      reportError(e, 'Não foi possível criar')
    }
  }

  const root = useFileSystemStore.getState().rootPath
  const menuItems: ContextMenuItem[] = [
    ...(node.isDirectory
      ? [
          {
            label: 'Novo arquivo',
            icon: FilePlus,
            action: () => onCreateIn(node.path, 'createFile')
          },
          {
            label: 'Nova pasta',
            icon: FolderPlus,
            action: () => onCreateIn(node.path, 'createFolder')
          }
        ]
      : []),
    {
      label: 'Renomear',
      icon: Edit,
      shortcut: 'F2',
      separator: node.isDirectory,
      action: () => setEditing({ type: 'rename', path: node.path })
    },
    { label: 'Excluir', icon: Trash, danger: true, shortcut: 'Del', action: () => onDelete(node) },
    {
      label: 'Copiar caminho relativo',
      icon: Copy,
      separator: true,
      action: () => navigator.clipboard.writeText(relativeTo(root, node.path))
    },
    { label: 'Mostrar no Explorer', icon: ExternalLink, action: () => window.api.reveal(node.path) }
  ]

  const isRenaming = editing?.type === 'rename' && editing.path === node.path
  const isCreatingChild = editing?.type !== 'rename' && editing?.path === node.path

  if (isRenaming) {
    return (
      <FileInput
        initialValue={node.name}
        type={node.isDirectory ? 'folder' : 'file'}
        depth={depth}
        onSubmit={handleRename}
        onCancel={() => setEditing(null)}
      />
    )
  }

  return (
    <div>
      <div
        ref={setRowRef}
        {...attributes}
        {...listeners}
        role="treeitem"
        aria-selected={isSelected}
        tabIndex={-1}
        className={clsx(
          'flex cursor-pointer items-center py-[3px] pr-2 outline-none',
          isOver
            ? 'bg-ide-select/60'
            : isSelected
              ? 'bg-ide-active text-white'
              : isActiveTab
                ? 'bg-ide-hover'
                : 'hover:bg-ide-hover',
          isDragging && 'opacity-40'
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={handleClick}
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          useFileSystemStore.getState().select(node.path)
          setMenuPos({ x: e.clientX, y: e.clientY })
        }}
      >
        <span
          className={clsx(
            'mr-0.5 flex w-4 flex-none justify-center text-gray-400 transition-transform duration-100',
            isExpanded && 'rotate-90'
          )}
        >
          {node.isDirectory && <ChevronRight size={14} />}
        </span>
        <span className="mr-1.5 flex-none">
          <FileIcon name={node.name} isDirectory={node.isDirectory} isOpen={isExpanded} />
        </span>
        <span className="flex-1 select-none truncate text-[13px]">{node.name}</span>
        {isDirty && (
          <span className="ml-1 h-2 w-2 flex-none rounded-full bg-white/70" title="Não salvo" />
        )}
      </div>

      {node.isDirectory && isExpanded && (
        <div role="group">
          {isCreatingChild && (
            <FileInput
              type={editing?.type === 'createFolder' ? 'folder' : 'file'}
              depth={depth + 1}
              onSubmit={handleCreate}
              onCancel={() => setEditing(null)}
            />
          )}
          {node.children?.map((child) => (
            <FileItem
              key={child.path}
              node={child}
              depth={depth + 1}
              editing={editing}
              setEditing={setEditing}
              onCreateIn={onCreateIn}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}

      <ContextMenu position={menuPos} items={menuItems} onClose={() => setMenuPos(null)} />
    </div>
  )
}
