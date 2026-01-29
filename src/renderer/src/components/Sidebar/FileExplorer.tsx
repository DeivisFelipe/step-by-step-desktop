import { useState } from 'react';
import { useFileSystemStore } from '../../store/useFileSystemStore';
import { useIDEStore } from '../../store/useIDEStore';
import { DndContext, DragEndEvent, useSensors, useSensor, PointerSensor, KeyboardSensor } from '@dnd-kit/core';
import { FileItem } from './FileItem';
import { FileExplorerHeader } from './FileExplorerHeader';
import { FileInput } from './FileInput';
import clsx from 'clsx';
import ContextMenu, { ContextMenuItem } from '../UI/ContextMenu';
import { FilePlus, FolderPlus, RefreshCw } from 'lucide-react';

// Type definitions shared or imported
interface EditingState {
  type: 'rename' | 'createFile' | 'createFolder';
  path: string; 
}

const FileExplorer = () => {
  const { rootPath, setRootPath, loadDir, fileTree, renameNode, createFile, createDirectory, collapseAll } = useFileSystemStore();
  const { activeFileId, setActiveFileId } = useIDEStore(); 
  
  const [isRootFocused, setIsRootFocused] = useState(false);
  const [editingState, setEditingState] = useState<EditingState | null>(null);
  const [isRootCreating, setIsRootCreating] = useState<'file' | 'folder' | null>(null);
  const [rootContextMenuPos, setRootContextMenuPos] = useState<{ x: number, y: number } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const handleOpenFolder = async () => {
     const path = await window.api.openFolder();
     if (path) {
        setRootPath(path);
        await loadDir(path);
     }
  };

  const handleRefresh = async () => {
    if (rootPath) await loadDir(rootPath);
  };
  
  const handleCollapseAll = () => {
     collapseAll();
  };

  const handleRootCreate = (name: string) => {
     if (!rootPath) return;
     const sep = rootPath.includes('\\') ? '\\' : '/';
     const path = `${rootPath}${sep}${name}`;
     
     if (isRootCreating === 'file') createFile(path);
     else createDirectory(path);
     
     setIsRootCreating(null);
  };

  // Improved Logic:
  // "Se tiver um folder selecionado tem que adicionar arquivo/folder a folder selecionada"
  // "Se não, adicionar ao workspace"
  const handleHeaderCreateFile = () => {
     if (activeFileId) {
        // Find node for activeFileId
        // If it's a directory, adding to it.
        // If it's a file, add to its parent.
        const node = findNode(fileTree, activeFileId);
        if (node) {
           if (node.isDirectory) {
               // Add to this folder
               // We need to trigger "inline create" on that FileItem.
               // But state is local to FileItem... 
               // We lifted state `editingState` which has `{ type, path }`.
               // So we can set editingState globally!
               setEditingState({ type: 'createFile', path: node.path });
               return; // Done
           } else {
               // Sibling
               const parentPath = node.path.replace(/[\\/][^\\/]+$/, '');
               // If parent is root?
               if (parentPath === rootPath) {
                   setIsRootCreating('file');
               } else {
                   setEditingState({ type: 'createFile', path: parentPath });
               }
               return;
           }
        }
     }
     // Fallback to root
     setIsRootCreating('file');
  };

  const handleHeaderCreateFolder = () => {
     if (activeFileId) {
        const node = findNode(fileTree, activeFileId);
        if (node) {
           if (node.isDirectory) {
               setEditingState({ type: 'createFolder', path: node.path });
               return;
           } else {
               const parentPath = node.path.replace(/[\\/][^\\/]+$/, '');
               if (parentPath === rootPath) {
                   setIsRootCreating('folder');
               } else {
                   setEditingState({ type: 'createFolder', path: parentPath });
               }
               return;
           }
        }
     }
     setIsRootCreating('folder');
  };

  // Helper to find node
  const findNode = (nodes: import('../../store/useFileSystemStore').FileNode[], path: string): import('../../store/useFileSystemStore').FileNode | null => {
      for (const node of nodes) {
          if (node.path === path) return node;
          if (node.children) {
              const found = findNode(node.children, path);
              if (found) return found;
          }
      }
      return null;
  };

  const handleBackgroundClick = (e: React.MouseEvent) => {
     e.stopPropagation();
     setIsRootFocused(true);
     // If clicking empty space, clear selection? Or keep focus on root?
     // " Tem que selecionar a raiz"
     setActiveFileId(null); 
  };
  
  const handleRootContextMenu = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setRootContextMenuPos({ x: e.clientX, y: e.clientY });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    // ... same ...
    const { active, over } = event;
    if (!over) return;
    if (active.id === over.id) return;
    const activePath = active.id as string;
    const overPath = over.id as string;
    if (overPath.startsWith(activePath)) return;
    const name = activePath.split(/[\\/]/).pop();
    const sep = overPath.indexOf('\\') !== -1 ? '\\' : '/'; 
    const newPath = `${overPath}${sep}${name}`;
    if (newPath === activePath) return;
    await renameNode(activePath, newPath);
  };

  const rootMenuItems: ContextMenuItem[] = [
      { label: 'New File', icon: FilePlus, action: () => setIsRootCreating('file') },
      { label: 'New Folder', icon: FolderPlus, action: () => setIsRootCreating('folder') },
      { label: 'Refresh', icon: RefreshCw, action: handleRefresh },
  ];

  return (
    <div className="h-full flex flex-col bg-[#252526] text-[#cccccc]" onClick={() => setIsRootFocused(false)}>
       <FileExplorerHeader 
          workspaceName={rootPath ? rootPath.split(/[\\/]/).pop() || 'WORKSPACE' : ''}
          onNewFile={handleHeaderCreateFile}
          onNewFolder={handleHeaderCreateFolder}
          onRefresh={handleRefresh}
          onCollapseAll={handleCollapseAll}
       />
       
       <div 
         className={clsx(
           "flex-1 overflow-y-auto relative outline-none",
           isRootFocused && "ring-1 ring-blue-500 ring-inset" // Use ring to avoid layout shift
         )}
         onClick={handleBackgroundClick}
         onContextMenu={rootPath ? handleRootContextMenu : undefined}
         tabIndex={0}
         onFocus={() => setIsRootFocused(true)}
         onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) {
               setIsRootFocused(false);
            }
         }}
       >
          {!rootPath ? (
             <div className="p-4 text-center">
                <p className="text-sm mb-4">No folder opened.</p>
                <button 
                  onClick={handleOpenFolder}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm"
                >
                  Open Folder
                </button>
             </div>
          ) : (
             <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                <div className="pb-4 relative">
                   {/* Root Level Creation */}
                   {isRootCreating && (
                      <FileInput 
                         type={isRootCreating}
                         depth={0}
                         onSubmit={handleRootCreate}
                         onCancel={() => setIsRootCreating(null)}
                      />
                   )}

                   {fileTree.map(node => (
                      <FileItem 
                         key={node.path} 
                         node={node} 
                         depth={0} 
                         editingState={editingState}
                         setEditingState={setEditingState}
                      />
                   ))}
                </div>
             </DndContext>
          )}
          
          <ContextMenu 
            position={rootContextMenuPos} 
            items={rootMenuItems} 
            onClose={() => setRootContextMenuPos(null)} 
          />
       </div>
    </div>
  );
};

export default FileExplorer;
