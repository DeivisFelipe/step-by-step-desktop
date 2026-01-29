import { useEffect, useRef } from 'react';
import { Edit, Trash, Type, Link, Plus } from 'lucide-react';

interface MenuProps {
  position: { x: number, y: number };
  onClose: () => void;
  onEdit?: () => void;
  onRename?: () => void;
  onDelete?: () => void;
  onAddNode?: () => void;
  type: 'node' | 'pane' | 'edge';
}

export const FlowContextMenu = ({ position, onClose, onEdit, onRename, onDelete, onAddNode, type }: MenuProps) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
        if (ref.current && !ref.current.contains(e.target as Node)) {
            onClose();
        }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  return (
    <div 
       ref={ref}
       className="fixed z-50 bg-[#252526] border border-[#3e3e42] shadow-xl rounded-md py-1 min-w-[150px] text-gray-300 text-xs"
       style={{ top: position.y, left: position.x }}
    >
       {type === 'node' && (
          <>
             <div onClick={onEdit} className="px-3 py-2 hover:bg-[#2a2d2e] cursor-pointer flex items-center">
                <Edit size={14} className="mr-2" /> Edit Step
             </div>
             <div onClick={onRename} className="px-3 py-2 hover:bg-[#2a2d2e] cursor-pointer flex items-center">
                <Type size={14} className="mr-2" /> Rename
             </div>
             <div className="h-[1px] bg-[#3e3e42] my-1" />
             <div onClick={onDelete} className="px-3 py-2 hover:bg-[#2a2d2e] cursor-pointer flex items-center text-red-400">
                <Trash size={14} className="mr-2" /> Delete
             </div>
          </>
       )}

       {type === 'pane' && (
          <div onClick={onAddNode} className="px-3 py-2 hover:bg-[#2a2d2e] cursor-pointer flex items-center">
             <Plus size={14} className="mr-2" /> Add Step
          </div>
       )}

       {type === 'edge' && (
           <div onClick={onDelete} className="px-3 py-2 hover:bg-[#2a2d2e] cursor-pointer flex items-center text-red-400">
              <Link size={14} className="mr-2" /> Delete Connection
           </div>
       )}
    </div>
  );
};
