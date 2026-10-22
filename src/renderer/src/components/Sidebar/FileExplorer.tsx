import { useState } from 'react'
import clsx from 'clsx'
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import { FilePlus, FolderPlus, ListCollapse, RefreshCw } from 'lucide-react'
import { FileNode, useFileSystemStore } from '../../store/useFileSystemStore'
import { reportError } from '../../store/useIDEStore'
import { basename, dirname, isInside, joinPath, samePath } from '../../lib/paths'
import { chooseWorkspace, getRecentFolders, openWorkspace } from '../../lib/workspace'
import ContextMenu, { ContextMenuItem } from '../UI/ContextMenu'
import { SidebarHeader } from './FileExplorerHeader'
import ProjectMenu from '../ProjectMenu'
import { EditingState, FileItem } from './FileItem'
import { FileInput } from './FileInput'

function findFileNode(nodes: FileNode[], path: string): FileNode | null {
  for (const node of nodes) {
    if (node.path === path) return node
    if (node.children) {
      const found = findFileNode(node.children, path)
      if (found) return found
    }
  }
  return null
}

async function confirmDelete(node: FileNode): Promise<void> {
  const choice = await window.api.showMessage({
    type: 'warning',
    message: `Excluir "${node.name}"?`,
    detail: node.isDirectory
      ? 'A pasta e todo o seu conteúdo serão excluídos permanentemente.'
      : 'O arquivo será excluído permanentemente.',
    buttons: ['Excluir', 'Cancelar'],
    defaultId: 1,
    cancelId: 1
  })
  if (choice !== 0) return
  try {
    await useFileSystemStore.getState().deleteNode(node.path)
  } catch (e) {
    reportError(e, 'Não foi possível excluir')
  }
}

const NoFolder = (): React.JSX.Element => {
  const recent = getRecentFolders()
  return (
    <div className="space-y-4 px-5 py-3 text-[13px]">
      <p className="text-gray-400">
        Nenhuma pasta aberta. Abra a pasta do projeto que será usado na aula.
      </p>
      <button
        onClick={chooseWorkspace}
        className="w-full rounded bg-ide-accent py-1.5 text-white hover:bg-sky-600"
      >
        Abrir pasta
      </button>
      {recent.length > 0 && (
        <div>
          <div className="mb-1 text-[11px] uppercase tracking-wider text-ide-muted">Recentes</div>
          {recent.map((path) => (
            <button
              key={path}
              onClick={() => openWorkspace(path)}
              className="block w-full truncate rounded px-1 py-0.5 text-left text-sky-400 hover:bg-ide-hover"
              title={path}
            >
              {basename(path)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const FileExplorer = (): React.JSX.Element => {
  const rootPath = useFileSystemStore((s) => s.rootPath)
  const fileTree = useFileSystemStore((s) => s.fileTree)
  const [editing, setEditing] = useState<EditingState | null>(null)
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const { setNodeRef: setRootDropRef, isOver: isOverRoot } = useDroppable({
    id: 'drop:__root__',
    data: { dir: rootPath },
    disabled: !rootPath
  })

  /** Starts inline creation inside `dir`, expanding it first. */
  const startCreate = async (dir: string, type: 'createFile' | 'createFolder'): Promise<void> => {
    const fs = useFileSystemStore.getState()
    if (rootPath && !samePath(dir, rootPath) && !fs.expanded[dir]) {
      useFileSystemStore.setState((s) => ({ expanded: { ...s.expanded, [dir]: true } }))
      await fs.refreshTree()
    }
    setEditing({ type, path: dir })
  }

  /** Directory where header actions create things: the selected folder, or the selection's folder. */
  const targetDir = (): string | null => {
    const { selectedPath } = useFileSystemStore.getState()
    if (!rootPath) return null
    if (!selectedPath) return rootPath
    const node = findFileNode(fileTree, selectedPath)
    if (!node) return rootPath
    return node.isDirectory ? node.path : dirname(node.path)
  }

  const createFromHeader = (type: 'createFile' | 'createFolder'): void => {
    const dir = targetDir()
    if (dir) startCreate(dir, type)
  }

  const handleRootCreate = async (name: string): Promise<void> => {
    if (!rootPath || !editing) return
    const type = editing.type
    setEditing(null)
    try {
      const target = joinPath(rootPath, name)
      if (type === 'createFolder') await useFileSystemStore.getState().createDirectory(target)
      else await useFileSystemStore.getState().createFile(target)
    } catch (e) {
      reportError(e, 'Não foi possível criar')
    }
  }

  const handleDragEnd = async (event: DragEndEvent): Promise<void> => {
    const { active, over } = event
    if (!over) return
    const from = String(active.id)
    const toDir = over.data.current?.dir as string | undefined
    if (!toDir || isInside(toDir, from) || samePath(dirname(from), toDir)) return
    try {
      await useFileSystemStore.getState().renameNode(from, joinPath(toDir, basename(from)))
    } catch (e) {
      reportError(e, 'Não foi possível mover')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    const { selectedPath } = useFileSystemStore.getState()
    if (!selectedPath || editing) return
    const node = findFileNode(fileTree, selectedPath)
    if (!node) return
    if (e.key === 'F2') {
      e.preventDefault()
      setEditing({ type: 'rename', path: node.path })
    } else if (e.key === 'Delete') {
      e.preventDefault()
      confirmDelete(node)
    }
  }

  const rootMenu: ContextMenuItem[] = [
    {
      label: 'Novo arquivo',
      icon: FilePlus,
      action: () => rootPath && startCreate(rootPath, 'createFile')
    },
    {
      label: 'Nova pasta',
      icon: FolderPlus,
      action: () => rootPath && startCreate(rootPath, 'createFolder')
    },
    {
      label: 'Atualizar',
      icon: RefreshCw,
      separator: true,
      action: () => useFileSystemStore.getState().refreshTree()
    }
  ]

  return (
    <div className="flex h-full flex-col">
      {rootPath && (
        <div className="flex-none px-3 pt-2">
          <ProjectMenu className="flex w-full items-center gap-1.5 rounded border border-ide-border bg-ide-bg px-2 py-1 text-left text-[12px] text-gray-200 hover:border-ide-accent [&>svg:last-child]:ml-auto" />
        </div>
      )}
      <SidebarHeader
        title={rootPath ? 'Arquivos' : 'Explorador'}
        actions={
          rootPath
            ? [
                {
                  icon: FilePlus,
                  title: 'Novo arquivo',
                  onClick: () => createFromHeader('createFile')
                },
                {
                  icon: FolderPlus,
                  title: 'Nova pasta',
                  onClick: () => createFromHeader('createFolder')
                },
                {
                  icon: RefreshCw,
                  title: 'Atualizar',
                  onClick: () => useFileSystemStore.getState().refreshTree()
                },
                {
                  icon: ListCollapse,
                  title: 'Recolher pastas',
                  onClick: () => useFileSystemStore.getState().collapseAll()
                }
              ]
            : []
        }
      />

      {!rootPath ? (
        <NoFolder />
      ) : (
        <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragEnd={handleDragEnd}>
          <div
            ref={setRootDropRef}
            role="tree"
            tabIndex={0}
            className={clsx(
              'flex-1 overflow-y-auto pb-6 outline-none',
              isOverRoot && 'bg-ide-select/20'
            )}
            onKeyDown={handleKeyDown}
            onClick={() => useFileSystemStore.getState().select(null)}
            onContextMenu={(e) => {
              e.preventDefault()
              setMenuPos({ x: e.clientX, y: e.clientY })
            }}
          >
            {editing && editing.type !== 'rename' && samePath(editing.path, rootPath) && (
              <FileInput
                type={editing.type === 'createFolder' ? 'folder' : 'file'}
                depth={0}
                onSubmit={handleRootCreate}
                onCancel={() => setEditing(null)}
              />
            )}
            {fileTree.map((node) => (
              <FileItem
                key={node.path}
                node={node}
                depth={0}
                editing={editing}
                setEditing={setEditing}
                onCreateIn={startCreate}
                onDelete={confirmDelete}
              />
            ))}
            {fileTree.length === 0 && !editing && (
              <p className="px-5 py-2 text-[13px] text-ide-muted">A pasta está vazia.</p>
            )}
          </div>
        </DndContext>
      )}

      <ContextMenu position={menuPos} items={rootMenu} onClose={() => setMenuPos(null)} />
    </div>
  )
}

export default FileExplorer
