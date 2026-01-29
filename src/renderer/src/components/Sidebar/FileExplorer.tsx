import { useFileSystemStore, FileNode } from '../../store/useFileSystemStore';
import { useIDEStore } from '../../store/useIDEStore';
import { ChevronRight, File, Folder, FilePlus, FolderPlus, Edit, Trash } from 'lucide-react';
import clsx from 'clsx';
import { useState } from 'react';
import ContextMenu, { ContextMenuItem } from '../UI/ContextMenu';
import { DndContext, DragEndEvent, useDraggable, useDroppable, useSensors, useSensor, PointerSensor, KeyboardSensor } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

const FileItem = ({ node, depth }: { node: FileNode, depth: number }) => {
  const { openFile, toggleDirectory, loadDir, createFile, createDirectory, renameNode, deleteNode } = useFileSystemStore();
  const { activeFileId, openTab } = useIDEStore();
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number, y: number } | null>(null);

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

  const getParentPath = (path: string) => path.replace(/[\\/][^\\/]+$/, '');
  const sep = node.path.indexOf('\\') !== -1 ? '\\' : '/';

  const onNewFile = async () => {
      const parent = node.isDirectory ? node.path : getParentPath(node.path);
      const name = window.prompt("New File Name:");
      if (name) {
          await createFile(`${parent}${sep}${name}`);
          await loadDir(parent);
          if (node.isDirectory && !node.isExpanded) toggleDirectory(node.path); 
      }
  };

  const onNewFolder = async () => {
      const parent = node.isDirectory ? node.path : getParentPath(node.path);
      const name = window.prompt("New Folder Name:");
      if (name) {
          await createDirectory(`${parent}${sep}${name}`);
          await loadDir(parent);
           if (node.isDirectory && !node.isExpanded) toggleDirectory(node.path);
      }
  };

  const onRename = async () => {
      const name = window.prompt("Rename to:", node.name);
      if (name && name !== node.name) {
          const parent = getParentPath(node.path);
          await renameNode(node.path, `${parent}${sep}${name}`);
          await loadDir(parent);
      }
  };

  const onDelete = async () => {
      if (window.confirm(`Delete ${node.name}?`)) {
          const parent = getParentPath(node.path);
          await deleteNode(node.path);
          await loadDir(parent);
      }
  };

  const menuItems: ContextMenuItem[] = [
    { label: 'New File', icon: FilePlus, action: onNewFile },
    { label: 'New Folder', icon: FolderPlus, action: onNewFolder },
    { label: 'Rename', icon: Edit, action: onRename },
    { label: 'Delete', icon: Trash, danger: true, action: onDelete }
  ];

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
             activeFileId === node.path && "bg-[#37373d] text-white",
             isOver && "bg-blue-800/50 border-2 border-blue-500" // Drop target highlight
          )}
          style={rowStyle}
          onClick={handleClick}
          onContextMenu={handleContextMenu}
        >
          <span className={clsx("mr-1 text-gray-400 transition-transform duration-200", node.isExpanded && "rotate-90")}>
             {node.isDirectory ? (
                <ChevronRight size={14} /> 
             ) : <div className="w-3.5" />}
          </span>
          <span className="mr-1 text-blue-400">
             {node.isDirectory ? <Folder size={14} /> : <File size={14} />}
          </span>
          <span className="text-sm truncate">{node.name}</span>
        </div>
        
        {node.children && node.isExpanded && (
           <div className="cursor-default" onPointerDown={e => e.stopPropagation()}> 
              {node.children.map(child => (
                 <FileItem key={child.path} node={child} depth={depth + 1} />
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

const FileExplorer = () => {
  const { rootPath, setRootPath, loadDir, fileTree, renameNode } = useFileSystemStore();
  
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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    if (active.id === over.id) return;

    const activePath = active.id as string;
    const overPath = over.id as string;

    // Check if moving to self or children (prevent cycle)
    if (overPath.startsWith(activePath)) return;

    const name = activePath.split(/[\\/]/).pop();
    const sep = overPath.indexOf('\\') !== -1 ? '\\' : '/'; 
    const newPath = `${overPath}${sep}${name}`;

    if (newPath === activePath) return;

    await renameNode(activePath, newPath);
    
    // Reload parents
    const oldParent = activePath.replace(/[\\/][^\\/]+$/, '');
    await loadDir(oldParent);
    await loadDir(overPath);
  };

  return (
    <div className="h-full flex flex-col bg-[#252526] text-[#cccccc]">
       <div className="px-5 py-2 text-xs font-bold tracking-wider uppercase flex justify-between items-center">
          <span>Explorer</span>
       </div>
       
       <div className="flex-1 overflow-y-auto">
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
                <div className="pb-4">
                   <div className="px-2 py-1 font-bold text-xs uppercase bg-[#333] truncate">
                      {rootPath.split(/[\\/]/).pop()}
                   </div>
                   {fileTree.map(node => (
                      <FileItem key={node.path} node={node} depth={0} />
                   ))}
                </div>
             </DndContext>
          )}
       </div>
    </div>
  );
};

export default FileExplorer;
