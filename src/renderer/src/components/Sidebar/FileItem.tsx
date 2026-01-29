import { useState } from 'react';
import { useFileSystemStore, FileNode } from '../../store/useFileSystemStore';
import { useIDEStore } from '../../store/useIDEStore';
import { ChevronRight, ChevronDown, FilePlus, FolderPlus, Edit, Trash } from 'lucide-react';
import clsx from 'clsx';
import ContextMenu, { ContextMenuItem } from '../UI/ContextMenu';
import { FileIcon } from '../UI/FileIcon';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { FileInput } from './FileInput';

interface EditingState {
  type: 'rename' | 'createFile' | 'createFolder';
  path: string; // Node path where action is happening (parent for create, self for rename)
}

interface FileItemProps {
  node: FileNode;
  depth: number;
  editingState: EditingState | null;
  setEditingState: (state: EditingState | null) => void;
  // Passing these down to avoid excessive store subscriptions if needed, 
  // but getting from store directly is fine.
}

export const FileItem = ({ node, depth, editingState, setEditingState }: FileItemProps) => {
  const { openFile, toggleDirectory, loadDir, createFile, createDirectory, renameNode, deleteNode } = useFileSystemStore();
  const { activeFileId, activeTabId, openTab } = useIDEStore(); // activeTabId or activeFileId? activeTabId check
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number, y: number } | null>(null);

  // DnD
  const { attributes, listeners, setNodeRef: setDraggableRef, transform, isDragging } = useDraggable({
    id: node.path,
    data: node
  });
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: node.path,
    disabled: !node.isDirectory
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    paddingLeft: `${depth * 10}px` 
  };
  const rowStyle = {
     paddingLeft: `${depth * 10 + 10}px`
  };

  // Interaction
  const handleClick = async (e: React.MouseEvent) => {
     e.stopPropagation();
     if (node.isDirectory) {
        if (!node.isExpanded && (!node.children || node.children.length === 0)) {
           await loadDir(node.path);
        } else {
           toggleDirectory(node.path);
        }
     } else {
        openTab({ id: node.path, type: 'FILE', title: node.name, path: node.path });
        openFile(node.path);
     }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
     e.preventDefault();
     e.stopPropagation();
     setContextMenuPos({ x: e.clientX, y: e.clientY });
  };

  // Actions
  const onNewFile = () => {
     if (!node.isDirectory) return; 
     // Expand if collapsed
     if (!node.isExpanded) toggleDirectory(node.path);
     setEditingState({ type: 'createFile', path: node.path });
  };
  const onNewFolder = () => {
     if (!node.isDirectory) return;
     if (!node.isExpanded) toggleDirectory(node.path);
     setEditingState({ type: 'createFolder', path: node.path });
  };
  const onRename = () => {
     setEditingState({ type: 'rename', path: node.path });
  };
  const onDelete = async () => {
      if (window.confirm(`Delete ${node.name}?`)) {
          await deleteNode(node.path);
      }
  };

  // Submit Handlers
  const handleRenameSubmit = async (newName: string) => {
     if (newName !== node.name) {
        const parent = node.path.replace(/[\\/][^\\/]+$/, ''); // Safer parent extraction?
        const sep = node.path.includes('\\') ? '\\' : '/';
        await renameNode(node.path, `${parent}${sep}${newName}`);
     }
     setEditingState(null);
  };

  const handleCreateSubmit = async (name: string, type: 'file' | 'folder') => {
      const parent = node.path;
      const sep = parent.includes('\\') ? '\\' : '/';
      const newPath = `${parent}${sep}${name}`;
      
      if (type === 'file') await createFile(newPath);
      else await createDirectory(newPath);
      
      setEditingState(null);
  };

  const menuItems: ContextMenuItem[] = [
    ...(node.isDirectory ? [
        { label: 'New File', icon: FilePlus, action: onNewFile },
        { label: 'New Folder', icon: FolderPlus, action: onNewFolder },
    ] : []),
    { label: 'Rename', icon: Edit, action: onRename },
    { label: 'Delete', icon: Trash, danger: true, action: onDelete }
  ];

  const isRenaming = editingState?.type === 'rename' && editingState.path === node.path;
  const isCreatingChild = (editingState?.type === 'createFile' || editingState?.type === 'createFolder') && editingState.path === node.path;

  // Render Rename Input
  if (isRenaming) {
     return (
        <FileInput 
           initialValue={node.name} 
           type={node.isDirectory ? 'folder' : 'file'}
           depth={depth}
           onSubmit={handleRenameSubmit}
           onCancel={() => setEditingState(null)}
        />
     );
  }

  return (
    <>
      <div 
         ref={setDraggableRef} 
         style={{ ...style, zIndex: isDragging ? 999 : 'auto', position: 'relative' }} 
         {...attributes} 
         {...listeners}
      >
        <div 
          ref={setDroppableRef}
          className={clsx(
             "flex items-center py-1 cursor-pointer hover:bg-[#2a2d2e] transition-colors",
             activeTabId === node.path && "bg-[#37373d] text-white", // Active selection highlight
             isOver && "bg-blue-800/50 border-2 border-blue-500"
          )}
          style={rowStyle}
          onClick={handleClick}
          onContextMenu={handleContextMenu}
        >
          <span className={clsx("mr-1 text-gray-400 transition-transform duration-200 flex-shrink-0", node.isExpanded && "rotate-90")}>
             {node.isDirectory ? (
                <ChevronRight size={14} /> 
             ) : <div className="w-3.5" />}
          </span>
          <span className="mr-1.5 flex-shrink-0">
             <FileIcon name={node.name} isDirectory={node.isDirectory} isOpen={node.isExpanded} />
          </span>
          <span className="text-sm truncate select-none">{node.name}</span>
        </div>
        
        {/* Children & Creation Input */}
        {node.isDirectory && node.isExpanded && (
           <div className="cursor-default" onPointerDown={e => e.stopPropagation()}> 
              {isCreatingChild && (
                 <FileInput 
                    type={editingState?.type === 'createFolder' ? 'folder' : 'file'}
                    depth={depth + 1}
                    onSubmit={val => handleCreateSubmit(val, editingState?.type === 'createFolder' ? 'folder' : 'file')}
                    onCancel={() => setEditingState(null)}
                 />
              )}
              {node.children?.map(child => (
                 <FileItem 
                    key={child.path} 
                    node={child} 
                    depth={depth + 1} 
                    editingState={editingState}
                    setEditingState={setEditingState}
                 />
              ))}
           </div>
        )}
      </div>

      <ContextMenu 
        position={contextMenuPos} 
        items={menuItems} 
        onClose={() => setContextMenuPos(null)} 
      />
    </>
  );
};
